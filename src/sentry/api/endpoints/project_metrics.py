from rest_framework.exceptions import ParseError
from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.snuba.metrics import DATA_SOURCE, InvalidField, InvalidParams, QueryDefinition


class ProjectMetricsEndpoint(ProjectEndpoint):
    """ Get metric name, type, unit and tag names """

    def get(self, request, project):
        metrics = DATA_SOURCE.get_metrics(project)
        return Response(metrics, status=200)


class ProjectMetricsTagsEndpoint(ProjectEndpoint):
    """ Get all existing tag values for a metric """

    def get(self, request, project):

        try:
            metric_name = request.GET["metric"]
            tag_name = request.GET["tag"]
        except KeyError:
            return Response({"detail": "`metric` and `tag` are required parameters."}, status=400)

        tag_values = DATA_SOURCE.get_tag_values(project, metric_name, tag_name)

        return Response(tag_values, status=200)


class ProjectMetricsDataEndpoint(ProjectEndpoint):
    """Get the time series data for one or more metrics.

    The data can be filtered and grouped by tags.
    Based on `OrganizationSessionsEndpoint`.
    """

    def get(self, request, project):

        try:
            query = QueryDefinition(request.GET, allow_minute_resolution=False)
            data = DATA_SOURCE.get_series(query)
        except (InvalidField, InvalidParams) as exc:
            raise (ParseError(detail=str(exc)))

        return Response(data, status=200)