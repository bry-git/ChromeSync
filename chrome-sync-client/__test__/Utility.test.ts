
import {compareData, compareTabGroups, compareTabs} from "../src/Utility";
import {ChromeSyncDataDTO, ChromeSyncTab, ChromeSyncTabGroup} from "../src/globals";
import BookmarkTreeNode = chrome.bookmarks.BookmarkTreeNode;
import exp = require("constants");
import ColorEnum = chrome.tabGroups.ColorEnum;


describe('Utility.ts tests', () => {

    const getTestTabs = (): ChromeSyncTab[] => {
        return [
            {
                url: "https://google.com",
                groupId: -1,
                id: 2047620621
            },
            {
                url: "https://yahoo.com",
                groupId: -1,
                id: 2047620622
            },
            {
                url: "https://apple.com",
                groupId: -1,
                id: 2047620623
            },
        ]
    }
    const getTestTabs2 = (): ChromeSyncTab[] => {
        return [
            {
                url: "https://hostname123.com",
                groupId: -1,
                id: 2047620610
            },
            {
                url: "https://hostname456.com",
                groupId: -1,
                id: 2047620611
            },
        ]
    }
    const getTestTabs3 = (): ChromeSyncTab[] => {
        return [
            {
                url: "https://cloudlfare.com",
                groupId: -1,
                id: 2047620710
            },
            {
                url: "https://medium.com",
                groupId: -1,
                id: 2047620811
            },
        ]
    }

    const getTestTabGroups = (): ChromeSyncTabGroup[] => {
        const testTabGroups = [
            {
                id: 892857732,
                title: "GROUP-A",
                color: "blue" as ColorEnum,
                tabs: new Array<ChromeSyncTab>(),
                windowId: 100
            },
            {
                id: 892857733,
                title: "GROUP-B",
                color: "red" as ColorEnum,
                tabs: new Array<ChromeSyncTab>(),
                windowId: 100
            }
        ]
        const tabsSet1 = getTestTabs().map((tab) => {
            tab.groupId = testTabGroups[0].id
            return tab
        })
        const tabsSet2 = getTestTabs2().map((tab) => {
            tab.groupId = testTabGroups[1].id
            return tab
        })
        testTabGroups[0].tabs = tabsSet1
        testTabGroups[1].tabs = tabsSet2
        return testTabGroups
    }

    const getTestChromeDataSyncDTO = (): ChromeSyncDataDTO => {
        return {
            timestamp: 0,
            orphanTabs: getTestTabs3(),
            groups: getTestTabGroups(),
            bookmarkTree: new Array<BookmarkTreeNode>(),
        } as ChromeSyncDataDTO
    }

    describe('compareTabs', () => {


        it('should return additions', () => {
            const old = getTestTabs()
            const latest = getTestTabs()

            const newTab = {
                url: "https://amazon.com",
                groupId: -1,
                id: 2047620624
            }
            latest.push(newTab)

            const diff = compareTabs(old, latest)

            expect(diff.tabsToAdd.length).toEqual(1)
            expect(diff.tabsToAdd[0]).toEqual(newTab)
        })
        it('should return deletions', () => {
            const old = getTestTabs()
            const latest = getTestTabs()

            latest.pop()
            const diff = compareTabs(old, latest)

            expect(diff.tabsToRemove.length).toEqual(1)
            expect(diff.tabsToAdd.length).toEqual(0)
        })
        it('should return a mixed diff', () => {
            const old = getTestTabs()
            let latest = getTestTabs()

            const newTabs = [
                {
                    url: "https://amazon.com",
                    groupId: -1,
                    id: 2047620624
                },
                {
                    url: "https://aws.com",
                    groupId: -1,
                    id: 2047620625
                }
            ]

            latest.pop()
            latest = latest.concat(newTabs)

            const diff = compareTabs(old, latest)

            expect(diff.tabsToAdd.length).toEqual(2)
            expect(diff.tabsToRemove.length).toEqual(1)
        })
        it('should return no diff when unchanged', () => {
            const old = getTestTabs()
            const latest = getTestTabs()

            const diff = compareTabs(old, latest)

            expect(diff.tabsToAdd.length).toEqual(0)
            expect(diff.tabsToRemove.length).toEqual(0)
        })
    })

    describe('compareTabGroups', () => {
        it('should return modified groups if title of a group is changed', () => {
            const old = getTestTabGroups()
            const latest = getTestTabGroups()

            latest[0].title = "MODIFIED NAME"

            const diff = compareTabGroups(old, latest)
            const modifiedsArray = Array.from(diff.groupsToModify)

            expect(modifiedsArray.length).toEqual(1)
        })
        it('should return modified groups if color of a group is changed', () => {
            const old = getTestTabGroups()
            const latest = getTestTabGroups()

            latest[0].color = "orange" as ColorEnum

            const diff = compareTabGroups(old, latest)
            const modifiedsArray = Array.from(diff.groupsToModify.values())

            expect(modifiedsArray.length).toEqual(1)
        })
        it('should return groups to add when groups are added', () => {
            const old = getTestTabGroups()
            const latest = getTestTabGroups()

            const newTabGroup: ChromeSyncTabGroup = {
                id: 892857738,
                title: "GROUP-D",
                color: "yellow",
                tabs: [{
                    url: "https://hostname789.com",
                    groupId: 892857738,
                    id: 2047620681
                }] as ChromeSyncTab[],
                windowId: 100
            }
            latest.push(newTabGroup)

            const diff = compareTabGroups(old, latest)
            const addedGroupsArray = Array.from(diff.groupsToAdd.values())

            expect(addedGroupsArray.length).toEqual(1)
            expect(addedGroupsArray[0]).toEqual(newTabGroup)
        })
        it('should return deletions if groups are removed', () => {
            const old = getTestTabGroups()
            const latest = getTestTabGroups()

            const removed = latest.pop()

            const diff = compareTabGroups(old, latest)
            const removalArray = Array.from(diff.groupsToRemove.values())
            expect(removalArray.length).toEqual(1)
            expect(removed).toEqual(removalArray[0])
        })
        it('should return a mixed diff', () => {
            const old = getTestTabGroups()
            const latest = getTestTabGroups()

            const newTabGroup: ChromeSyncTabGroup = {
                id: 892857738,
                title: "GROUP-D",
                color: "yellow",
                tabs: [{
                    url: "https://hostname789.com",
                    groupId: 892857738,
                    id: 2047620681
                }] as ChromeSyncTab[],
                windowId: 100
            }
            // removed group should be in groupsToRemove
            const removed = latest.pop()
            // added group should be in groupsToAdd
            latest.push(newTabGroup)
            // modified group should be in groupsToModify
            latest[0].title = "EDITED NAME"

            const diff = compareTabGroups(old, latest)
            const addsArray = Array.from(diff.groupsToAdd.values())

            expect(addsArray.length).toEqual(1)
            expect(addsArray[0]).toEqual(newTabGroup)

            const removeArray = Array.from(diff.groupsToRemove.values())

            expect(removeArray.length).toEqual(1)
            expect(removeArray[0]).toEqual(removed)

            const modifiedArray = Array.from(diff.groupsToModify.values())

            expect(modifiedArray.length).toEqual(1)
            expect(modifiedArray[0].title).toEqual("EDITED NAME")

        })
        it('should return no diff when unchanged', () => {
            const old = getTestTabGroups()
            const latest = getTestTabGroups()

            const diff = compareTabGroups(old, latest)

            expect(Array.from(diff.groupsToAdd.values()).length).toEqual(0)
            expect(Array.from(diff.groupsToModify.values()).length).toEqual(0)
            expect(Array.from(diff.groupsToRemove.values()).length).toEqual(0)
        })
    })
    describe('compareBookmarks', () => {

    })
    describe('compareData', () => {
        it('should return additions of tab groups', () => {
            const local = getTestChromeDataSyncDTO()
            const remote = getTestChromeDataSyncDTO()

            const newTabGroup: ChromeSyncTabGroup = {
                id: 892857738,
                title: "GROUP-D",
                color: "yellow" as ColorEnum,
                tabs: [{
                    url: "https://hostname789.com",
                    groupId: 892857738,
                    id: 2047620681
                }] as ChromeSyncTab[],
                windowId: 100
            }
            remote.groups.push(newTabGroup)

            const diff = compareData(local, remote)

            expect(diff.additions.groups.has(892857738)).toEqual(true)
            expect(Array.from(diff.additions.groups).length).toEqual(1)
        })
        it('should return modifications in grouped tabs', () => {
            const local = getTestChromeDataSyncDTO()
            const remote = getTestChromeDataSyncDTO()

            const newTabInGroup: ChromeSyncTab = {
                url: 'https://github.com',
                groupId: remote.groups[0].id,
                id: 123
            }
            remote.groups[0].tabs.push(newTabInGroup)
            const removedTabFromGroup = remote.groups[0].tabs.shift()

            const diff = compareData(local, remote)

            const modArray = Array.from(diff.modifications.groups.values())
            expect(modArray.length).toEqual(1)
            expect(diff.modifications.groups.get(remote.groups[0].id)).toEqual(remote.groups[0])
            expect(modArray[0].tabs.some((tab) => tab.url === 'https://github.com')).toEqual(true)
            expect(modArray[0].tabs.some((tab) => tab.url === removedTabFromGroup!!.url)).toEqual(false)
        })
    })
})