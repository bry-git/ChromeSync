import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Badge,
  Box,
  Button,
  ColumnLayout,
  Icon,
  Modal,
  ProgressBar,
  SpaceBetween,
  Spinner,
  StatusIndicator,
} from "@cloudscape-design/components";
import {
  compareData,
  emptyChromeSyncDataDiff,
  enactDiff,
  epochToDate,
  getLocalChromeDataDTO,
  setLastSyncedDataHash,
  setLastSyncedTime,
  setLastWindowId,
  waitForLoad,
} from "./Utility";
import { ChromeSyncDataDiff } from "./globals";
import {ENDPOINT, getRemoteData, updateRemoteData} from "./HttpClient";

export const SyncBadge = ({
  time,
  dataIsUnchanged,
}: {
  time: number;
  dataIsUnchanged: boolean;
}): React.ReactElement => {
  if (time < 1) return <Badge color="red">Never Synced</Badge>;
  const compareTime = Date.now();
  const stale = compareTime - time > 864000;
  if (stale) {
    //TODO use BadgeProps
    return <Badge color="red">{`Last sync ${epochToDate(time)}`}</Badge>;
  } else if (!stale && dataIsUnchanged) {
    return <Badge color="green">{`Last sync ${epochToDate(time)}`}</Badge>;
  } else if (stale && !dataIsUnchanged) {
    return <Badge color="red">{`Last sync ${epochToDate(time)}`}</Badge>;
  } else {
    return <Badge color="grey">{`Last sync ${epochToDate(time)}`}</Badge>;
  }
};

export const ChromeSyncAlert = ({ dataIsUnchanged }: { dataIsUnchanged: boolean }): React.ReactElement => {
  if (dataIsUnchanged) {
    return (
      <Alert>ChromeDataSync currently only supports synchronization of the window the extension is used from.</Alert>
    );
  } else {
    return (
      <Alert statusIconAriaLabel="Warning" type="warning">
        The local browser state has changed since last sync
      </Alert>
    );
  }
};

// @ts-ignore
export const ValueWithLabel = ({ label, children }) => (
  <div>
    <Box variant="awsui-key-label">{label}</Box>
    <div>{children}</div>
  </div>
);

const DiffView = ({ diffData }: { diffData: ChromeSyncDataDiff }): React.ReactElement => {
  const { additions, modifications, deletions } = diffData;
  let addedTitles: string[] = [];
  let moddedTitles: string[] = [];
  let deletedTitles: string[] = [];

  additions.orphanTabs.forEach((t) => addedTitles.push(t.url as string));
  Array.from(additions.groups.values()).forEach((g) => addedTitles.push(g.title as string));
  //TODO bookmarks

  modifications.orphanTabs.forEach((t) => moddedTitles.push(t.url as string));
  Array.from(modifications.groups.values()).forEach((g) => moddedTitles.push(g.title as string));

  deletions.orphanTabs.forEach((t) => deletedTitles.push(t.url as string));
  Array.from(deletions.groups.values()).forEach((g) => deletedTitles.push(g.title as string));

  return (
    <>
      <ColumnLayout columns={3}>
        <ValueWithLabel
          label="additions"
          children={
            <ul>
              {addedTitles.length <= 6
                ? addedTitles.map((item) => {
                    return <li>{item}</li>;
                  })
                : addedTitles
                    .slice(0, 5)
                    .map((item) => {
                      return <li>{item}</li>;
                    })
                    .concat([<li>{`and ${Number(addedTitles.length - 6)} more`}</li>])}
            </ul>
          }
        />
        <ValueWithLabel
          label="modifications"
          children={
            <ul>
              {moddedTitles.length <= 6
                ? moddedTitles.map((item) => {
                    return <li>{item}</li>;
                  })
                : moddedTitles
                    .slice(0, 5)
                    .map((item) => {
                      return <li>{item}</li>;
                    })
                    .concat([<li>{`and ${Number(moddedTitles.length - 6)} more`}</li>])}
            </ul>
          }
        />
        <ValueWithLabel
          label="deletions"
          children={
            <ul>
              {deletedTitles.length <= 6
                ? deletedTitles.map((item) => {
                    return <li>{item}</li>;
                  })
                : deletedTitles
                    .slice(0, 5)
                    .map((item) => {
                      return <li>{item}</li>;
                    })
                    .concat([<li>{`and ${Number(deletedTitles.length - 6)} more`}</li>])}
            </ul>
          }
        />
      </ColumnLayout>
    </>
  );
};

// @ts-ignore
export const ChromeSyncModal = ({showSyncModal, setShowSyncModal, setLastSynced, setWindowChanged, data,}): React.ReactElement => {
  const [diffData, setDiffData] = useState(emptyChromeSyncDataDiff());
  const [tabsLoaded, setTabsLoaded] = useState(true);
  const [initialTabsToLoad, setInitialTabsToLoad] = useState(-1);
  const [tabsToLoad, setTabsToLoad] = useState(-1);
  const [canOverride, setCanOverride] = useState(false)

  const override = useRef(false)

  useEffect(() => {
    (async function () {
      if (data && showSyncModal && tabsLoaded) {
        const localDataDTO = await getLocalChromeDataDTO();
        const diff = compareData(localDataDTO, data);
        setDiffData(diff);
      }
    })();
  }, [data, showSyncModal, tabsLoaded]);

  const handleOkClick = async () => {
    try {
      await enactDiff(diffData); // make changes to browser

      const totalTabs = await chrome.tabs.query({})
      setInitialTabsToLoad(totalTabs.length)

      setTabsLoaded(false);
      let loadTime = 0

      // wait for tabs to load, otherwise the local data will have tabs with undefined urls
      let loading = await chrome.tabs.query({ status: "loading" });

      do { // wait for tabs to load or user override
        const scanTimeMillis = 250
        await new Promise((resolve) => setTimeout(resolve, scanTimeMillis));

        loading = await chrome.tabs.query({ status: "loading" });
        setTabsToLoad(prevTabsToLoad => loading.length);

        if (loadTime >= 5000) {
          await new Promise((resolve) => {
            resolve(setCanOverride(prevCanOverride => true))})
        }
        if(override.current == true) {
          break
        }
        loadTime += scanTimeMillis
      } while (loading.length !== 0);

      setTabsLoaded(true);

      const updatedLocalData = await getLocalChromeDataDTO(); // get new local data hash
      await setLastSyncedDataHash(updatedLocalData); // setLastSyncDataHash
      await updateRemoteData(updatedLocalData); // send regenerated tabGroup Ids to remote
      await setLastWindowId(); //set last window id
      await setWindowChanged(false);
      setLastSynced(await setLastSyncedTime()); // await set last synced time
      setShowSyncModal(false); // close modal

    } catch (error) {
      alert(`there was an error when attempting to synchronize data: ${error}`);
    }
  };

  const handleCancelClick = () => {
    setShowSyncModal(false);
  };

  const handleOverrideClick = () => {
    override.current = true
  };

  const calcProg = () => {
    if (initialTabsToLoad === -1) {
      return 0
    } else {
      return ((initialTabsToLoad - tabsToLoad) / initialTabsToLoad) * 100
    }
  }

  return (
    <div className="awsui-dark-mode">
      <Modal
        onDismiss={() => setShowSyncModal(false)}
        visible={showSyncModal}
        closeAriaLabel="Close modal"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xxs">
              <Button variant="link" onClick={handleCancelClick}>
                Cancel
              </Button>
              {(!tabsLoaded) ? (
                  <>
                    <Button variant="primary" disabled={(canOverride == false)} onClick={handleOverrideClick}>
                      Continue Anyway
                    </Button>
                  </>
              ) : (
                  <>
                    <Button variant="primary" disabled={!tabsLoaded} onClick={handleOkClick}>
                      Ok
                    </Button>
                  </>
              )
              }

            </SpaceBetween>
          </Box>
        }
        header={tabsLoaded ? "Are You Sure?" : "Getting local Browser up to date..."}
      >
        {" "}
        {tabsLoaded ? (
          <>
            The local data is behind the remote. Synchronizing will enact these changes:
            <DiffView diffData={diffData} />
          </>
        ) : (
          <>
            <ProgressBar
              value={calcProg()}
              description="please do not close, some resources are still loading"
              label="Loading"
            />
          </>
        )}
      </Modal>
    </div>
  );
};

// @ts-ignore
export const ChromeSyncSettingsModal = ({ showSettingsModal, setShowSettingsModal }): React.ReactElement => {
  const handleCloseClick = () => setShowSettingsModal(false);
  const handleForcePushClick = async () => {
    const currentData = await getLocalChromeDataDTO();
    try {
      const response = await updateRemoteData(currentData);
      alert(`response: ${response.status}`);
    } catch (error) {
      alert(error);
    }
  };
  const handleResetClick = async () => {
    await chrome.storage.local.set({ ChromeDataSyncReceipt: null });
    await chrome.storage.local.set({ ChromeSyncLastDataHash: null });
    alert("removed client side tracking data");
  };
  const handleConnectTest = async () => {
    try {
      await getRemoteData();
      alert("connection OK");
    } catch (error) {
      alert(error);
    }
  };
  const handleEndpointClick = () => {
    window.open(ENDPOINT, '_blank')
  }

  return (
    <Modal
      onDismiss={() => setShowSettingsModal(false)}
      visible={showSettingsModal}
      closeAriaLabel="Close modal"
      footer={
        <Box float="right">
          <Button variant="primary" onClick={handleCloseClick}>
            Close
          </Button>
        </Box>
      }
      header="Settings"
    >
      {" "}
      <ColumnLayout borders="horizontal" variant="text-grid" columns={2}>
        <div style={{ marginTop: "35px" }}>
          <Button onClick={handleForcePushClick}>Force push</Button>
        </div>
        <p>Force push the local data to the remote. Will overwrite the previous data on the remote</p>
        <div style={{ marginTop: "35px" }}>
          <Button onClick={handleResetClick}>Reset Data</Button>
        </div>
        <p>Removes all extension data stored in the client. No change is made to tabs, groups, or bookmarks</p>
        <div style={{ marginTop: "20px" }} onClick={handleEndpointClick}>
          <code>{ENDPOINT}</code>
          <Icon name="external" variant="link"/>
        </div>
        <p>The endpoint that this client points to for synchronization</p>
        <div style={{ marginTop: "20px" }}>
          <Button onClick={handleConnectTest}>Test Connection</Button>
        </div>
        <p>Test sync endpoint reachability</p>
      </ColumnLayout>
    </Modal>
  );
};
