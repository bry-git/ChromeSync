import React, { useEffect, useState } from "react";
import "./App.css";
import "@cloudscape-design/global-styles/index.css";
import { Button, ContentLayout, Container, Header, SpaceBetween, Link, Badge } from "@cloudscape-design/components";
import { getRemoteData, updateRemoteData } from "./HttpClient";
import { ChromeSyncAlert, ChromeSyncModal, ChromeSyncSettingsModal, SyncBadge, ValueWithLabel } from "./Components";
import {
  getLastSyncedDataHash,
  getLastSyncTime,
  getLastWindowId,
  getLocalChromeDataDTO,
  getSlant,
  hashData,
  setLastSyncedDataHash,
  setLastSyncedTime,
} from "./Utility";

function App() {
  const [slant, setSlant] = useState({ tabCount: 0, groupCount: 0, bookmarks: 0 });
  const [data, setData] = useState({});
  // modal state
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  // local data condition state
  const [lastSynced, setLastSynced] = useState(0);
  const [dataIsUnchanged, setDataIsUnchanged] = useState(false);
  const [windowChanged, setWindowChanged] = useState(false);

  useEffect(() => {
    (async function () {
      // read last receipt in local storage
      const lastSyncedReceipt = await getLastSyncTime();
      setLastSynced(lastSyncedReceipt);
      // query browser data TODO consolidate slant and data states to reduce renders
      const currentLocalData = await getLocalChromeDataDTO();
      setSlant(getSlant(currentLocalData));
      // check if data has changed locally
      const currentHash = hashData(currentLocalData);
      const storedHash = await getLastSyncedDataHash();
      if (lastSyncedReceipt > 0) setDataIsUnchanged(currentHash === storedHash);
      // check if the window has changed, usually means chrome has closed & re-opened
      const currentWindow = await chrome.windows.getCurrent();
      const lastWindowId = await getLastWindowId();
      if (currentWindow.id !== lastWindowId) setWindowChanged(true);
      console.log("cycle");
    })();
  }, [data, showSyncModal, showSettingsModal]); // only execute if these states change

  const handleSyncClick = async () => {
    const localDataDTO = await getLocalChromeDataDTO();
    const lastSyncReceipt = await getLastSyncTime();
    let remoteDataDTO;
    try {
      remoteDataDTO = await getRemoteData();
    } catch (error) {
      alert(error);
    }
    // if the receipt is old or the window has changed
    if (lastSyncReceipt < remoteDataDTO.timestamp || windowChanged) {
      // shows the modal where decision is made to sync or not
      setData(remoteDataDTO);
      setShowSyncModal(true);
    } else {
      // client is up-to-date, update data on remote
      try {
        await updateRemoteData(localDataDTO);
        await setLastSyncedDataHash(await getLocalChromeDataDTO());
        await setLastSyncedTime();
        await setData(localDataDTO);
      } catch (error) {
        alert(error);
      }
    }
  };

  const handleSettingsClick = () => setShowSettingsModal(true);

  return (
    <div className="App awsui-dark-mode">
      <div className="content">
        <ContentLayout
          header={
            <SpaceBetween size="l">
              <Header
                variant="h3"
                info={<Link href="http://github.com">Source Code</Link>}
                description={<SyncBadge time={lastSynced} dataIsUnchanged={dataIsUnchanged} />}
                actions={
                  <Button variant="primary" onClick={handleSyncClick}>
                    Synchronize
                  </Button>
                }
              >
                Chrome Data Sync
              </Header>
              <ChromeSyncAlert dataIsUnchanged={dataIsUnchanged}></ChromeSyncAlert>
            </SpaceBetween>
          }
        >
          <Container header={<Header headingTagOverride="h4">Current Data</Header>}>
            <SpaceBetween size="xxl" direction="horizontal">
              <ValueWithLabel label="Tab Groups">
                <Badge>{slant.groupCount}</Badge>
              </ValueWithLabel>
              <ValueWithLabel label="Tabs Open">
                <Badge>{slant.tabCount}</Badge>
              </ValueWithLabel>
              <ValueWithLabel label="Bookmarks">
                <Badge>{slant.bookmarks}</Badge>
              </ValueWithLabel>
              <Button variant="normal" onClick={handleSettingsClick}>
                Settings
              </Button>
            </SpaceBetween>
          </Container>
          <ChromeSyncModal
            showSyncModal={showSyncModal}
            setShowSyncModal={setShowSyncModal}
            setLastSynced={setLastSynced}
            setWindowChanged={setWindowChanged}
            data={data}
          />
          <ChromeSyncSettingsModal showSettingsModal={showSettingsModal} setShowSettingsModal={setShowSettingsModal} />
        </ContentLayout>
      </div>
    </div>
  );
}

export default App;
