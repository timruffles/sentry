import {Fragment} from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import ExternalLink from 'app/components/links/externalLink';
import {IconClose} from 'app/icons/iconClose';
import {t} from 'app/locale';
import space from 'app/styles/space';

import Status from './status';
import {GitActivity} from '.';

// https://docs.github.com/en/rest/reference/pulls
type Props = {
  gitActivity: GitActivity;
  onUnlink: (gitActivity: GitActivity) => Promise<void>;
};

function Activity({gitActivity, onUnlink}: Props) {
  return (
    <Fragment>
      <StatusColumn>
        <Status state={gitActivity.state} />
      </StatusColumn>
      <Column>
        <ExternalLink href={gitActivity.url}>{gitActivity.title}</ExternalLink>
      </Column>
      <ActionColumn>
        <StyledButton
          size="zero"
          icon={<IconClose size="xs" />}
          title={t('Unlink Pull Request')}
          label={t('Unlink Pull Request')}
          onClick={() => onUnlink(gitActivity)}
          borderless
        />
      </ActionColumn>
    </Fragment>
  );
}

export default Activity;

const Column = styled('div')`
  padding: ${space(1)} 0;
  height: 100%;
  line-height: 20px;
`;

const StatusColumn = styled(Column)`
  padding-right: ${space(1.5)};
  padding-left: ${space(0.5)};
`;

const ActionColumn = styled(Column)`
  padding-left: ${space(1.5)};
  padding-right: ${space(0.5)};
`;

const StyledButton = styled(Button)`
  height: 20px;
  width: 16px;
`;
