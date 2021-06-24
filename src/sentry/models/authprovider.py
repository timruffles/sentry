import logging

from django.db import models, transaction
from django.db.models.signals import post_save
from django.utils import timezone

from bitfield import BitField
from sentry import options
from sentry.db.models import (
    BoundedPositiveIntegerField,
    EncryptedJsonField,
    FlexibleForeignKey,
    Model,
    sane_repr,
)

logger = logging.getLogger("sentry.authprovider")

SCIM_INTERNAL_INTEGRATION_OVERVIEW = (
    "This internal integration was auto-generated during the installation process of your SCIM "
    "integration. It is needed to provide the token used provision members and teams. If this integration is "
    "deleted, your SCIM integration will stop working!"
)


class AuthProvider(Model):
    __include_in_export__ = True

    organization = FlexibleForeignKey("sentry.Organization", unique=True)
    provider = models.CharField(max_length=128)
    config = EncryptedJsonField()

    date_added = models.DateTimeField(default=timezone.now)
    sync_time = BoundedPositiveIntegerField(null=True)  # Not used at all
    last_sync = models.DateTimeField(null=True)  # Not used at all

    default_role = BoundedPositiveIntegerField(default=50)
    default_global_access = models.BooleanField(default=True)
    # TODO(dcramer): ManyToMany has the same issue as ForeignKey and we need
    # to either write our own which works w/ BigAuto or switch this to use
    # through.
    default_teams = models.ManyToManyField("sentry.Team", blank=True)

    flags = BitField(
        flags=(
            ("allow_unlinked", "Grant access to members who have not linked SSO accounts."),
            ("scim_enabled", "Enable SCIM for member and team provisioning and syncing"),
        ),
        default=0,
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_authprovider"

    __repr__ = sane_repr("organization_id", "provider")

    def __str__(self):
        return self.provider

    @transaction.atomic()
    def save(self, *args, **kwargs):
        """
        For migration to IdentityProvider.
        Wrap in a transaction so the pre_save will dual-write to IdentityProvider
        """
        super().save(*args, **kwargs)

    def get_provider(self):
        from sentry.auth import manager

        return manager.get(self.provider, **self.config)

    def get_scim_token(self):
        from sentry.models import SentryAppInstallationForProvider

        if self.flags.scim_enabled:
            return SentryAppInstallationForProvider.get_token(
                self.organization, f"{self.provider}_scim"
            )
        else:
            logger.warning(
                "SCIM disabled but tried to access token",
                extra={"organization_id": self.organization.id},
            )
            return None

    def get_scim_url(self):
        if self.flags.scim_enabled:
            url_prefix = options.get("system.url-prefix")
            return f"{url_prefix}/api/0/organizations/{self.organization.slug}/scim/v2/"
        else:
            return None

    def enable_scim(self, user):
        from sentry.mediators.sentry_apps import InternalCreator
        from sentry.models import SentryAppInstallation, SentryAppInstallationForProvider

        if (
            not self.get_provider().can_use_scim(self.organization, user)
            or self.flags.scim_enabled is True
        ):
            logger.warning(
                "SCIM already enabled",
                extra={"organization_id": self.organization.id},
            )
            return

        # check if we have a scim app already

        if SentryAppInstallationForProvider.objects.filter(
            organization=self.organization, provider="okta_scim"
        ).exists():
            logger.warning(
                "SCIM installation already exists",
                extra={"organization_id": self.organization.id},
            )
            return

        data = {
            "name": "SCIM Internal Integration",
            "author": "Auto-generated by Sentry",
            "organization": self.organization,
            "overview": SCIM_INTERNAL_INTEGRATION_OVERVIEW,
            "user": user,
            "scopes": [
                "member:read",
                "member:write",
                "member:admin",
                "team:write",
                "team:admin",
            ],
        }
        # create the internal integration and link it to the join table
        sentry_app = InternalCreator.run(**data)
        sentry_app_installation = SentryAppInstallation.objects.get(sentry_app=sentry_app)
        SentryAppInstallationForProvider.objects.create(
            sentry_app_installation=sentry_app_installation,
            organization=self.organization,
            provider=f"{self.provider}_scim",
        )
        self.flags.scim_enabled = True

    def disable_scim(self, user):
        from sentry.mediators.sentry_apps import Destroyer
        from sentry.models import SentryAppInstallationForProvider

        if self.flags.scim_enabled:
            install = SentryAppInstallationForProvider.objects.get(
                organization=self.organization, provider=f"{self.provider}_scim"
            )
            Destroyer.run(sentry_app=install.sentry_app_installation.sentry_app, user=user)
            self.flags.scim_enabled = False

    def get_audit_log_data(self):
        return {"provider": self.provider, "config": self.config}


def handle_auth_provider_post_save(instance, **kwargs):
    from sentry.models import IdentityProvider

    IdentityProvider.objects.create(
        organization=instance.organization,
        type=instance.provider,
        provider=instance.provider,
        external_id=None,
        provider_id=None,
        config=instance.config,
        is_sso=True,
        sso_default_team=None,
        sso_default_role=instance.default_role,
        sso_default_global_access=instance.default_global_access,
        sso_flags=instance.flags,
        authprovider=instance,
    )


post_save.connect(
    handle_auth_provider_post_save,
    sender="sentry.AuthProvider",
    dispatch_uid="handle_auth_provider_pre_save",
    weak=False,
)
