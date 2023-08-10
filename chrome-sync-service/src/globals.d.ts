//import BookmarkTreeNode = chrome.bookmarks.BookmarkTreeNode; TODO import the chrome types here too

export interface ChromeSyncTab {
  url: string;
  groupId?: number;
}

export interface ChromeSyncTabGroup {
  id: number;
  title: string;
  color: string;
  tabs: ChromeSyncTab[];
  windowId: number;
}

/**
 * timestamp: epoch time on eval time from browser
 * groups: tab group array that holds child tabs
 * orphanTabs: orphan tabs not in a group
 * bookmarkTree: all bookmarks
 */
export interface ChromeSyncData {
  timestamp: number;
  groups: Map<ChromeSyncTabGroup>;
  orphanTabs: ChromeSyncTab[];
  bookmarkTree: []; //BookmarkTreeNode[] TODO
}

export interface ChromeSyncDataModel {}
