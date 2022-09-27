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

            // Create Container
            const newTrContainer = document.createElement('tr');
            newTrContainer.id = `pullRequestExtensionTrContainer-${pullRequestId}`; // Add id so can be deleted above


            const newTdContainer = document.createElement('td');
            newTdContainer.id = `pullRequestExtensionTdContainer-${pullRequestId}`;
            newTdContainer.colSpan = "24"; // TODO this should be dynamic by getting the total colspan from the previous row that is visible (some tds have display none);
            newTdContainer.classList.add('pullRequestExtensionTd');
            newTdContainer.style.backgroundColor = "#F6EFA6";
            newTdContainer.style.padding = "3px 10px";
            newTdContainer.style.fontSize = "12px";
            newTdContainer.style.width = "100%";
            newTdContainer.style.color = "#66B3BA";
            newTdContainer.style.fontWeight = "bold";

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

    async fetchPullRequest(pullRequestId) {
        // TODO Get this URL more dynamically (listen to network requests, etc)
        const response = await fetch(`https://bitbucket.org/!api/2.0/repositories/vailresorts/vailresorts.digital.ecommerce/pullrequests/${pullRequestId}/diffstat`);
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
            dotsettings: "netural",
            yml: "netural",
            config: "neutral",
            txt: "neutral",
            json: "neutral",
        }

        const fileExtensionsMemo = {};

        function setFileExtensionFromString(str) {
            const fileExtensionParts = str.split(".");
            fileExtensionsMemo[fileExtensionParts[fileExtensionParts.length - 1]] = true;
        }

        function drawFileExtensions() {
            Object.keys(fileExtensionsMemo).forEach(extension => {
                const item = document.createElement('div');
                if (extensionDefinitions[extension.toLowerCase()]) {
                    switch (extensionDefinitions[extension.toLowerCase()]) {
                        case "frontend":
                            item.style.backgroundColor = "green";
                            item.style.color = "white";
                            break;
                        case "fullstack":
                            item.style.backgroundColor = "orange";
                            item.style.color = "white";
                            break;
                        case "backend":
                            item.style.backgroundColor = "purple";
                            item.style.color = "white";
                            break;
                        case "neutral":
                            item.style.backgroundColor = "black";
                            item.style.color = "white";
                            break;

                    }
                } else {
                    item.style.backgroundColor = "red";
                    item.style.color = "white";
                }
                item.style.padding = "1px 8px";
                item.style.borderRadius = "10px";
                item.style.textAlign = "center";
                item.style.margin = "0 1px";
                item.style.textTransform = "uppercase";
                item.style.fontSize = "10px";

                item.textContent = extension.toLowerCase();
                parentDivContainer.appendChild(item);
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
    console.log('Running', tab.url);
    const initiated = new BitbuckPrStats(tab.url);
    initiated.init();
});

