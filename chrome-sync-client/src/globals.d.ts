import BookmarkTreeNode = chrome.bookmarks.BookmarkTreeNode;
import ColorEnum = chrome.tabGroups.ColorEnum;

export interface ChromeSyncTab {
  url?: string | undefined;
  groupId?: number;
  id?: number;
}

export interface ChromeSyncTabGroup {
  id: number;
  title: string | undefined;
  color: ColorEnum;
  tabs: ChromeSyncTab[];
  windowId: number;
}

/**
 * groups: tab group array that holds child tabs
 * orphanTabs: orphan tabs not in a group
 * bookmarkTree: all bookmarks
 */
export interface ChromeSyncData {
  groups: Map<number, ChromeSyncTabGroup>;
  orphanTabs: ChromeSyncTab[];
  bookmarkTree: BookmarkTreeNode[];
}

/**
 * timestamp: epoch time on eval time from browser
 * groups: tab group array that holds child tabs
 * orphanTabs: orphan tabs not in a group
 * bookmarkTree: all bookmarks
 */
export interface ChromeSyncDataDTO {
  timestamp: number;
  groups: ChromeSyncTabGroup[];
  orphanTabs: ChromeSyncTab[];
  bookmarkTree: BookmarkTreeNode[];
}

export interface ChromeSyncDataDiff {
  additions: ChromeSyncData;
  modifications: ChromeSyncData;
  deletions: ChromeSyncData;
}
