import sha256 from "crypto-js/sha256";
import { ChromeSyncData, ChromeSyncDataDiff, ChromeSyncDataDTO, ChromeSyncTab, ChromeSyncTabGroup } from "./globals";
import BookmarkTreeNode = chrome.bookmarks.BookmarkTreeNode;

const CHROME_SYNC_DATA_RECEIPT_KEY = "ChromeDataSyncReceipt";
const CHROME_SYNC_LAST_DATA_HASH = "ChromeSyncLastDataHash";
const CHROME_SYNC_LAST_WINDOW_ID = "ChromeSyncLastWindowId";

/**
 * Gets the last successful data sync receipt time stored in extensions local storage
 */
export const getLastSyncTime = async (): Promise<number> => {
  let time = await chrome.storage.local.get([CHROME_SYNC_DATA_RECEIPT_KEY]);
  time = time.ChromeDataSyncReceipt;
  return !time ? -1 : Number(time);
};

/**
 * Sets the data sync receipt in the extensions local storage to the epoch time
 * at which the method was called
 */
export const setLastSyncedTime = async (): Promise<number> => {
  const time = Date.now();
  await chrome.storage.local.set({ ChromeDataSyncReceipt: time });
  return time;
};

export const hashData = (data: ChromeSyncDataDTO): string => {
  const comparable = {
    ...data.groups,
    ...data.orphanTabs,
    ...data.bookmarkTree,
  };
  return sha256(JSON.stringify(comparable)).toString();
};

/**
 * checks the hashed value of the chrome data the last time that there was
 * a successful sync, so that the UI can reflect there are uncommitted changes
 */
export const getLastSyncedDataHash = async (): Promise<string> => {
  let hash = await chrome.storage.local.get([CHROME_SYNC_LAST_DATA_HASH]);
  hash = hash.ChromeSyncLastDataHash;
  return !hash ? "" : String(hash);
};

/**
 * sets the hash value of the data passed in to the extensions local storage
 * for comparison later. this does not consider the timestamp
 * @param data: ChromeSyncDataDTO
 */
export const setLastSyncedDataHash = async (data: ChromeSyncDataDTO): Promise<string> => {
  const hash = hashData(data);
  await chrome.storage.local.set({ ChromeSyncLastDataHash: hash });
  return hash;
};

/**
 * gets the id stored in extension local storage of the last window used
 */
export const getLastWindowId = async (): Promise<number> => {
  let id = await chrome.storage.local.get([CHROME_SYNC_LAST_WINDOW_ID]);
  id = id.ChromeSyncLastWindowId;
  return !id ? -1 : Number(id);
};

/**
 * sets the id stored in extension local storage to the id of the
 * current window when called
 */
export const setLastWindowId = async (): Promise<number> => {
  const window = await chrome.windows.getCurrent();
  await chrome.storage.local.set({ ChromeSyncLastWindowId: window.id });
  // @ts-ignore
  return window.id;
};

export const epochToDate = (epoch: number): string => {
  const date = new Date(0);
  date.setUTCMilliseconds(epoch);
  return date.toString();
};

export const getSlant = (data: ChromeSyncDataDTO) => {
  const slant = {
    tabCount: 0,
    groupCount: 0,
    bookmarks: 0,
  };
  slant.tabCount = data.orphanTabs.length;
  slant.groupCount = data.groups.length;
  data.groups.forEach((group) => {
    slant.tabCount += group.tabs.length;
  });
  // @ts-ignore
  if (data.bookmarkTree[0].children[0].title === "Bookmarks Bar") {
    // @ts-ignore
    slant.bookmarks = data.bookmarkTree[0].children[0].children.length;
    // @ts-ignore
    data.bookmarkTree[0].children[0].children.forEach((node) => {
      // there is either a bookmark or a folder that has child bookmarks on the bookmarks bar
      if (node.children) {
        slant.bookmarks += node.children.length;
      } else slant.bookmarks++;
    });
  } else
    throw Error(
      "unable to determine path to Bookmarks Bar, Chrome Data Sync only supports synchronization of Bookmarks Bar"
    );
  return slant;
};

/**
 * get the data from the browser
 * this function is used to get the data without a timestamp
 * for hash value comparison
 */
export async function getLocalChromeData(): Promise<ChromeSyncData> {
  const rawTabs = await chrome.tabs.query({});
  const rawGroups = await chrome.tabGroups.query({});

  //ES6 Map should be loaded into an array to be json serializable
  const chromeSyncData: ChromeSyncData = {
    groups: new Map<number, ChromeSyncTabGroup>(),
    orphanTabs: new Array<ChromeSyncTab>(),
    bookmarkTree: new Array<BookmarkTreeNode>(),
  };

  chromeSyncData.bookmarkTree = await new Promise((resolve, reject) => {
    chrome.bookmarks.getTree((bookmarkTreeNodeArray) => {
      resolve(bookmarkTreeNodeArray);
    });
  });

  rawGroups.forEach((g) => {
    const chromeSyncTabGroup: ChromeSyncTabGroup = {
      id: g.id,
      title: g.title,
      color: g.color,
      tabs: new Array<ChromeSyncTab>(),
      windowId: g.windowId,
    };
    chromeSyncData.groups.set(g.id, chromeSyncTabGroup);
  });

  rawTabs.forEach((t) => {
    const tab: ChromeSyncTab = {
      url: t.url,
      groupId: t.groupId,
      id: t.id,
    };
    if (t.groupId == -1) {
      chromeSyncData.orphanTabs.push(tab);
    } else {
      // @ts-ignore
      chromeSyncData.groups.get(t.groupId).tabs.push(tab);
    }
  });

  return chromeSyncData;
}

/**
 * use this function to format the data to send to the remote
 */
export async function getLocalChromeDataDTO(): Promise<ChromeSyncDataDTO> {
  const data = await getLocalChromeData();
  const DTO: ChromeSyncDataDTO = {
    timestamp: Date.now(),
    groups: Array.from(data.groups.values()),
    orphanTabs: data.orphanTabs,
    bookmarkTree: data.bookmarkTree,
  };
  return DTO;
}

export function compareDataHash(local: ChromeSyncDataDTO, remote: ChromeSyncDataDTO): boolean {
  const localComparable = {
    ...local.groups,
    ...local.orphanTabs,
    ...local.bookmarkTree,
  };
  const remoteComparable = {
    ...remote.groups,
    ...remote.orphanTabs,
    ...remote.bookmarkTree,
  };
  const localDataHash = sha256(JSON.stringify(localComparable)).toString();
  const remoteDataHash = sha256(JSON.stringify(remoteComparable)).toString();
  return localDataHash === remoteDataHash;
}

/**
 * @param old ChromeSyncTab[]
 * @param latest ChromeSyncTab[]
 * compares an old set of Chrome tabs to the newest and returns a diff
 * that is shaped like:
 * @returns object {
 *     tabsToAdd: [],
 *     tabsToRemove: []
 * }
 */
export const compareTabs = (old: ChromeSyncTab[], latest: ChromeSyncTab[]) => {
  if (!old || !latest) throw Error("Compare tabs args are null");
  const result = {
    tabsToAdd: new Array<ChromeSyncTab>(),
    tabsToRemove: new Array<ChromeSyncTab>(),
  };
  const oldTabsMap = new Map<number, ChromeSyncTab>();
  old.forEach((tab) => oldTabsMap.set(<number>tab.id, tab));

  latest.forEach((tab, index) => {
    if (oldTabsMap.has(<number>tab.id)) {
      oldTabsMap.delete(<number>tab.id);
    } else {
      result.tabsToAdd.push(tab);
    }
  });
  result.tabsToRemove = Array.from(oldTabsMap.values());
  return result;
};

/**
 * @param old ChromeSyncTabGroup[]
 * @param latest ChromeSyncTabGroup[]
 * compares arrays of tab groups and returns a diff that is
 * shaped like
 * @returns object {
 *     groupsToAdd: Map<number, ChromeSyncTabGroup>,
 *     groupsToModify: Map<number, ChromeSyncTabGroup>,
 *     groupsToRemove: Map<number, ChromeSyncTabGroup>,
 * }
 */
export const compareTabGroups = (old: ChromeSyncTabGroup[], latest: ChromeSyncTabGroup[]) => {
  const result = {
    groupsToAdd: new Map<number, ChromeSyncTabGroup>(),
    groupsToModify: new Map<number, ChromeSyncTabGroup>(),
    groupsToRemove: new Map<number, ChromeSyncTabGroup>(),
  };
  const oldGroupsMap = new Map<number, ChromeSyncTabGroup>();
  old.forEach((group) => oldGroupsMap.set(group.id, group));

  latest.forEach((group) => {
    if (oldGroupsMap.has(group.id)) {
      const oldGroup = oldGroupsMap.get(group.id);
      // @ts-ignore
      const groupLabelIsEdited = group.title !== oldGroup.title || group.color !== oldGroup.color;
      // @ts-ignore
      const tabArrayDiff = compareTabs(oldGroup.tabs, group.tabs);
      if (tabArrayDiff.tabsToAdd.length !== 0 || tabArrayDiff.tabsToRemove.length !== 0 || groupLabelIsEdited) {
        result.groupsToModify.set(group.id, group);
      }
      oldGroupsMap.delete(group.id);
    } else {
      result.groupsToAdd.set(group.id, group);
    }
  });
  result.groupsToRemove = oldGroupsMap;

  return result;
};

// @ts-ignore
export const emptyChromeSyncDataDiff = (): ChromeSyncDataDiff => {
  return {
    additions: {
      orphanTabs: new Array<ChromeSyncTab>(),
      groups: new Map<number, ChromeSyncTabGroup>(),
      bookmarkTree: new Array<BookmarkTreeNode>(),
    },
    modifications: {
      orphanTabs: new Array<ChromeSyncTab>(),
      groups: new Map<number, ChromeSyncTabGroup>(),
      bookmarkTree: new Array<BookmarkTreeNode>(),
    },
    deletions: {
      orphanTabs: new Array<ChromeSyncTab>(),
      groups: new Map<number, ChromeSyncTabGroup>(),
      bookmarkTree: new Array<BookmarkTreeNode>(),
    },
  };
};

export function compareData(local: ChromeSyncDataDTO, remote: ChromeSyncDataDTO): ChromeSyncDataDiff {
  const { additions, modifications, deletions } = emptyChromeSyncDataDiff();

  const { tabsToRemove, tabsToAdd } = compareTabs(local.orphanTabs, remote.orphanTabs);
  additions.orphanTabs = additions.orphanTabs.concat(tabsToAdd);
  deletions.orphanTabs = deletions.orphanTabs.concat(tabsToRemove);

  const { groupsToRemove, groupsToModify, groupsToAdd } = compareTabGroups(local.groups, remote.groups);
  additions.groups = groupsToAdd;
  modifications.groups = groupsToModify;
  deletions.groups = groupsToRemove;

  return {
    additions,
    modifications,
    deletions,
  };
}

export async function enactDiff(diffData: ChromeSyncDataDiff): Promise<void> {
  const { additions, modifications, deletions } = diffData;
  const window = await chrome.windows.getCurrent();
  const windowId = window.id;
  if (!windowId) throw Error("window.id is not set in browser");
  // operation is interrupted if tabs.remove is called on current active tab
  let currentTab = await chrome.tabs.query({ active: true, currentWindow: true });
  let currentTabId = currentTab[0].id;

  // helper reused in add and modify operations
  const buildGroups = async (groupMap: Map<number, ChromeSyncTabGroup>, windowId: number) => {
    for (const group of Array.from(groupMap.values())) {
      const tabIds: number[] = [];
      for (const tab of group.tabs) {
        if (!tab.url) throw Error(`tab: ${JSON.stringify(tab)} has no url`);
        const recreatedTab = await chrome.tabs.create({
          url: tab.url,
          active: false,
          selected: false,
          windowId: windowId,
        });
        if (recreatedTab.id != null) {
          tabIds.push(recreatedTab.id);
        }
      }
      const groupId = await chrome.tabs.group({ tabIds: tabIds });
      await chrome.tabGroups.update(groupId, {
        title: group.title,
        color: group.color,
        collapsed: true,
      });
    }
  };
  const teardownGroups = async (groupMap: Map<number, ChromeSyncTabGroup>) => {
    for (const group of Array.from(groupMap.values())) {
      const tabsInGroup = await chrome.tabs.query({ groupId: group.id });
      for (const tab of tabsInGroup) {
        if (tab.id != null && tab.id !== currentTabId) {
          await chrome.tabs.remove(tab.id);
        } else if (tab.id === currentTabId) {
          await chrome.tabs.group({ tabIds: [<number>currentTabId] });
        }
      }
    }
  };
  //additions
  for (const tab of additions.orphanTabs) {
    await chrome.tabs.create({
      url: tab.url,
      active: false,
      selected: false,
      windowId: windowId,
    });
  }
  await buildGroups(additions.groups, windowId);
  //modifications
  await teardownGroups(modifications.groups);
  await buildGroups(modifications.groups, windowId);
  //deletions
  for (const tab of deletions.orphanTabs) {
    if (tab.id != null && tab.id !== currentTabId) {
      await chrome.tabs.remove(tab.id);
    }
  }
  await teardownGroups(deletions.groups);
}

/**
 * wait until there are no loading tabs to continue
 */
export async function waitForLoad(): Promise<void> {
  while (true) {
    const loading = await chrome.tabs.query({ status: "loading" });
    if (loading.length === 0) return;
    else {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log(loading);
    }
  }
}
