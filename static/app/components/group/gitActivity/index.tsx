import {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import Clipboard from 'app/components/clipboard';
import ShortId from 'app/components/shortId';
import Tooltip from 'app/components/tooltip';
import {IconCopy} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';

import SidebarSection from '../sidebarSection';

import Activity from './activity';
import UnlinkedActivity from './unlinked';

// https://docs.github.com/en/rest/reference/pulls
export type GitActivity = {
  id: string;
  url: string;
  title: string;
  // State of the Pull Request. Either open or closed
  state: 'open' | 'closed' | 'merged' | 'draft' | 'created' | 'closed';
  type: 'branch' | 'pull_request';
  author: string;
  visible: boolean;
};

type Props = {
  api: Client;
  issueId: string;
  shortId: string;
};

function GitActivity({api, issueId, shortId}: Props) {
  const [linkedActivities, setLinkedActivities] = useState<GitActivity[]>([]);
  const [unlinkedActivities, setUnlinkedActivities] = useState<GitActivity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    fetchActivities();
  }, []);

  async function fetchActivities() {
    setIsLoading(true);
    try {
      const response: GitActivity[] = await api.requestPromise(
        `/issues/${issueId}/github-activity/`
      );
      const activities = response.filter(gitActivity => gitActivity.visible);
      setLinkedActivities(activities);
      const unlinked = response.filter(gitActivity => !gitActivity.visible);
      setUnlinkedActivities(unlinked);
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      setIsError(true);
    }
  }

  async function handleUnlinkPullRequest(gitActivity: GitActivity) {
    try {
      api.requestPromise(`/issues/${issueId}/github-activity/${gitActivity.id}/`, {
        method: 'PUT',
        data: {visible: 0},
      });
      const newActivities = linkedActivities.filter(
        activity => activity.id !== gitActivity.id
      );
      setLinkedActivities(newActivities);
      unlinkedActivities.push(gitActivity);
      setUnlinkedActivities(unlinkedActivities);
      addSuccessMessage(t('Pull Request was successfully unlinked'));
    } catch (error) {
      addErrorMessage(t('An error occurred while unlinkig the Pull Request'));
    }
  }

  async function handleRelinkPullRequest(gitActivity: GitActivity) {
    try {
      api.requestPromise(`/issues/${issueId}/github-activity/${gitActivity.id}/`, {
        method: 'PUT',
        data: {visible: 1},
      });
      linkedActivities.push(gitActivity);
      setLinkedActivities(linkedActivities);

      const newUnlinkedActivities = unlinkedActivities.filter(
        activity => activity.id !== gitActivity.id
      );
      setUnlinkedActivities(newUnlinkedActivities);
      addSuccessMessage(t('Pull Request was successfully linked'));
    } catch (error) {
      addErrorMessage(t('An error occurred while linkig the Pull Request'));
    }
  }

  if (isLoading) {
    return null;
  }

  if (isError) {
    return null;
  }

  return (
    <SidebarSection title={t('Git Activity')}>
      <IssueId>
        {t('Issue Id')}
        <IdAndCopyAction>
          <StyledShortId shortId={`#FIXES-${shortId}`} />
          <CopyButton>
            <Clipboard value={`FIXES-${shortId}`}>
              <Tooltip title={shortId} containerDisplayMode="flex">
                <StyledIconCopy />
              </Tooltip>
            </Clipboard>
          </CopyButton>
        </IdAndCopyAction>
      </IssueId>
      <Activities>
        {linkedActivities.map(activity => (
          <Activity
            key={activity.id}
            gitActivity={activity}
            onUnlink={handleUnlinkPullRequest}
          />
        ))}
      </Activities>
      {unlinkedActivities.length > 0 && (
        <UnlinkedActivity
          unlinkedActivities={unlinkedActivities}
          onRelink={handleRelinkPullRequest}
        />
      )}
    </SidebarSection>
  );
}

export default GitActivity;

const IssueId = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  display: grid;
  grid-gap: ${space(0.5)};
  margin-bottom: ${space(2)};
  font-weight: 700;
`;

const IdAndCopyAction = styled('div')`
  display: flex;
  align-items: center;
  font-weight: 400;
`;

const StyledShortId = styled(ShortId)`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.textColor};
  background: ${p => p.theme.backgroundSecondary};
  padding: ${space(1)};
  border-radius: ${p => p.theme.borderRadius};
  font-weight: 400;
  justify-content: flex-start;
  flex: 1;
`;

const CopyButton = styled('div')`
  padding: 0 ${space(0.5)} 0 ${space(1.5)};
`;

const StyledIconCopy = styled(IconCopy)`
  cursor: pointer;
`;

const Activities = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr max-content;
  margin: -${space(1)} 0;
  > * {
    &:nth-last-child(n + 4) {
      border-bottom: 1px solid ${p => p.theme.innerBorder};
    }
  }
`;
