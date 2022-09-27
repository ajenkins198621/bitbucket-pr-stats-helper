class BitbuckPrStats {

    fullUrl;
    isLoaded;
    pullRequestIds;

    constructor(fullUrl) {
        this.fullUrl = fullUrl;
        this.isLoaded = false;
        this.pullRequestIds = [];
    }

    init() {
        this.checkPullRequestRowsExist();
    }

    checkPullRequestRowsExist() {
        let i = 1;
        setTimeout(() => { // Keep arrow func
            if (this.getPullRequestRowsQuery().length > 0) {
                i = 14; // will not go into subseqent conditional
                // Let's go!
                this.isLoaded = true;
                this.pullRequestIds = this.getPullRequestIds();
                this.drawNewContainers();
                this.fetchPullRequestsData();
            }
            i++;
            if (i < 15 && !this.isLoaded) {
                // No pull request rows found
                this.checkPullRequestRowsExist();
            }
        }, 1000)
    }


    getPullRequestRowsQuery() {
        return document.querySelectorAll('[data-qa="pull-request-row"]');
    }



    getPullRequestIds() {
        const pullRequestIds = [];
        const pullRequestRows = this.getPullRequestRowsQuery();
        if (!pullRequestRows || !pullRequestRows.length) {
            return [];
        }
        for (let i = 0; i < pullRequestRows.length; i++) {
            const pullRequestRow = pullRequestRows[i]; // tr
            const anchorTags = pullRequestRow.getElementsByTagName('a'); // [a]
            if (!anchorTags || !anchorTags[0]) {
                continue;
            }
            const anchorTag = anchorTags[0]; // The first anchor tag with the pull request
            const pullRequestUrl = anchorTag.href;
            const pullRequestUrlParts = pullRequestUrl.split("/");
            const pullRequestId = pullRequestUrlParts[pullRequestUrlParts.length - 1];
            pullRequestIds.push({
                trRef: pullRequestRow, // A reference to the parent <tr> to access later
                pullRequestId
            });
        }
        return pullRequestIds;
    }

    drawNewContainers() {
        this.pullRequestIds.forEach(({ trRef, pullRequestId }) => {

            // Check if existing - if yes, skip creating new container
            const hasExistingContainer = document.getElementById(`pullRequestExtensionTrContainer-${pullRequestId}`);
            if (hasExistingContainer) {
                return;
            }

            // Create Container
            const newTrContainer = document.createElement('tr');
            newTrContainer.id = `pullRequestExtensionTrContainer-${pullRequestId}`; // Add id so can be deleted above


            const newTdContainer = document.createElement('td');
            newTdContainer.id = `pullRequestExtensionTdContainer-${pullRequestId}`;
            newTdContainer.colSpan = "24"; // TODO this should be dynamic by getting the total colspan from the previous row that is visible (some tds have display none);
            newTdContainer.classList.add('pullRequestExtensionTd');

            // Create Loading Text
            const loadingText = document.createElement('div');
            loadingText.innerText = 'Loading file extensions...';


            newTdContainer.appendChild(loadingText);
            newTrContainer.appendChild(newTdContainer)
            trRef.after(newTrContainer);
        })
    }

    fetchPullRequestsData() {
        if (!this.pullRequestIds || !this.pullRequestIds.length) {
            // TODO HANDLE ERROR - delete newly created rows or show error?
            return;
        }
        this.pullRequestIds.forEach(async pullRequestId => {
            await this.fetchPullRequest(pullRequestId.pullRequestId);
        })

    }

    getBitbucketUrlDetails() {
        const hrefParts = window.location.href.split("/");
        for(let i = 0; i < hrefParts.length; i++) {
            if(hrefParts[i].trim() === "bitbucket.org") {
                return {
                    org: hrefParts[i + 1],
                    repo: hrefParts[i + 2]
                }
            }
        }
        return { org: "", repo: "" }; 
    }

    async fetchPullRequest(pullRequestId) {
        const { org, repo } = this.getBitbucketUrlDetails();
        const response = await fetch(`https://bitbucket.org/!api/2.0/repositories/${org}/${repo}/pullrequests/${pullRequestId}/diffstat`);
        const changes = await response.json();
        if (!changes || !changes.values || !changes.values.length) {
            return;
        }

        const parentTdContainer = document.getElementById(`pullRequestExtensionTdContainer-${pullRequestId}`);
        parentTdContainer.innerHTML = "";
        const parentDivContainer = document.createElement('div');
        parentDivContainer.style.display = "flex";
        parentTdContainer.appendChild(parentDivContainer);

        // "frontend", "backend", "fullstack", "neutral"
        const extensionDefinitions = {
            js: "frontend",
            jsx: "frontend",
            less: "frontend",
            css: "frontend",
            png: "frontend",
            jpg: "frontend",
            cshtml: "fullstack",
            cs: "backend",
            csproj: "neutral",
            svg: "frontend",
            dotsettings: "neutral",
            yml: "neutral",
            config: "neutral",
            txt: "neutral",
            json: "neutral",
            resx: "fullstack",
            ttf: "frontend",
            woff: "frontend",
            gitignore: "neutral",
            eslintignore: "neutral",
            ico: "frontend",
            aspx: "backend",
        }

        const stackItemInitalObject = {
            count: 0,
            filetypes: {},
            usedStrings: {}
        }

        const stackMemo = {
            frontend: {
                count: 0,
                filetypes: {},
                usedStrings: {}
            },
            backend: {
                count: 0,
                filetypes: {},
                usedStrings: {}
            },
            fullstack: {
                count: 0,
                filetypes: {},
                usedStrings: {}
            },
            neutral: {
                count: 0,
                filetypes: {},
                usedStrings: {}
            },
            unknown: {
                count: 0,
                filetypes: {},
                usedStrings: {}
            },
        };

        function setFileExtensionFromString(str) {
            const fileExtensionParts = str.split(".");
            const particalExtension = fileExtensionParts[fileExtensionParts.length - 1].toLowerCase();

            const filePathParts = str.split("/");
            const fileName = filePathParts[filePathParts.length - 1];
            const fileNameParts = fileName.split(".");
            const fullExtension = fileNameParts.filter((part, idx) => {
                if (idx === 0 && fileNameParts.length > 1) {
                    return false;
                }
                return true;
            }).join(".");

            const extensionDefinition = extensionDefinitions[particalExtension] || "unknown";
            if (stackMemo[extensionDefinition].usedStrings[str]) {
                return;
            }
            stackMemo[extensionDefinition].usedStrings[str] = true;
            if (extensionDefinition === "unknown") {
                console.log('------> Missing extension', particalExtension);
            }

            stackMemo[extensionDefinition].count++;
            if (!stackMemo[extensionDefinition].filetypes[fullExtension]) {
                stackMemo[extensionDefinition].filetypes[fullExtension] = 0;
            }
            stackMemo[extensionDefinition].filetypes[fullExtension]++;
        }

        function drawFileExtensions() {
            ['frontend', 'backend', 'fullstack', 'neutral', 'unknown'].forEach(stack => {
                if (stackMemo[stack].count === 0) {
                    return;
                }

                const dropdownContainer = document.createElement('div');
                dropdownContainer.classList.add("dropdownContainer")


                const item = document.createElement('a');
                item.classList.add('stackBadge')
                item.classList.add(stack);
                item.textContent = `${stackMemo[stack].count} ${stack}`;


                const dropdownList = document.createElement('div');
                dropdownList.classList.add('extensionDropdown');
                dropdownList.classList.add(stack);

                const dropdownListInner = document.createElement('div');
                dropdownListInner.classList.add('extensionDropdownInner');

                Object.keys(stackMemo[stack].filetypes).forEach(key => {
                    const listItem = document.createElement('div');
                    listItem.textContent = `${stackMemo[stack].filetypes[key]} - ${key}`;
                    dropdownListInner.appendChild(listItem);
                });

                dropdownList.appendChild(dropdownListInner);

                dropdownContainer.appendChild(item);
                dropdownContainer.appendChild(dropdownList);

                parentDivContainer.appendChild(dropdownContainer);

            })

        }

        changes.values.forEach((value, idx) => {
            if (value.new && value.new.path) {
                setFileExtensionFromString(value.new.path);
            }

            if (value.old && value.old.path) {
                setFileExtensionFromString(value.old.path);
            }
            if (idx === (changes.values.length - 1)) {
                drawFileExtensions();
            }
        });
    }
}


// Memo the currentUrl so we only initiate changes when the URL actually changes
let currentUrl = "";

// Array of acceptable URL parts.  Add/remove strings to allow to scripts to execute on other pages.
// TODO make these regex instead
const acceptedUrlParts = [
    "/pull-requests"
];

// Here we listen for the changes sent from background.js
chrome.runtime.onMessage.addListener(({ tab }) => {
    if (!tab || !tab.url || tab.url === currentUrl) {
        return;
    }

    // Set current URL
    currentUrl = tab.url;

    // Check to ensure the current URL path is allowed
    let isEligibleUrlPath = false;
    for (let i = 0; i < acceptedUrlParts.length; i++) {
        if (tab.url.includes(acceptedUrlParts[i])) {
            isEligibleUrlPath = true;
        }
    }
    if (!isEligibleUrlPath) {
        return;
    }


    // Let's go!
    const initiated = new BitbuckPrStats(tab.url);
    initiated.init();
});

