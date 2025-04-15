// background.js

// --- Context Menu Management ---
async function updateContextMenu() {
    try {
        await chrome.contextMenus.removeAll();
    } catch (error) {
        console.warn("Error removing context menus, proceeding anyway:", error);
    }

    let workflows = [];
    try {
      const result = await chrome.storage.sync.get(['workflows']);
      workflows = result.workflows || [];
    } catch(error) {
        console.error("Error fetching workflows from storage for context menu:", error);
         chrome.notifications.create(`storage-error-ctx-${Date.now()}`, {
            type: 'basic', iconUrl: 'icons/icon48.png',
            title: 'Storage Error', message: 'Could not load workflow configurations for context menu.'
         });
        return; // Stop if workflows can't be loaded
    }


    if (workflows.length > 0) {
        // Create a parent menu item
        try {
            chrome.contextMenus.create({
                id: "n8n-trigger-parent",
                title: "Trigger n8n Workflow",
                contexts: ["page", "selection", "link", "image"] // Where the menu should appear
            });

            // Add each workflow as a child item
            workflows.forEach((wf, index) => {
                 // Basic validation before creating menu item
                 if (wf && wf.name && typeof wf.name === 'string' && wf.webhookUrl) {
                     chrome.contextMenus.create({
                         id: `n8n-trigger-${index}`, // Unique ID using index
                         parentId: "n8n-trigger-parent",
                         title: wf.name,
                         contexts: ["page", "selection", "link", "image"]
                     });
                 } else {
                     console.warn(`Skipping invalid workflow at index ${index} for context menu:`, wf);
                 }
            });

        } catch(error) {
            console.error("Error creating context menu items:", error);
        }
    }
}

// Run when extension is installed or updated, or Chrome starts
chrome.runtime.onInstalled.addListener((details) => {
    updateContextMenu(); // Initial setup or update context menu
});

// Listen for messages (e.g., from manage.js when workflows change)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "updateContextMenu") {
        updateContextMenu().then(() => {
            sendResponse({ status: "Context menu update finished" });
        }).catch(error => {
            console.error("Failed to update context menu:", error);
            sendResponse({ status: "Context menu update failed", error: error.message });
        });
        return true; // Indicates asynchronous response
    }
    return false; // No async response planned for other messages
});


// --- Webhook Triggering ---
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!tab || info.parentMenuItemId !== "n8n-trigger-parent" || !info.menuItemId.startsWith("n8n-trigger-")) {
        return;
    }

    const workflowIndex = parseInt(info.menuItemId.split('-').pop(), 10);
    if (isNaN(workflowIndex)) {
        console.error("Could not parse workflow index from menu item ID:", info.menuItemId);
        return;
    }

    let workflows = [];
     try {
       const result = await chrome.storage.sync.get(['workflows']);
       workflows = result.workflows || [];
     } catch(error) {
         console.error("Error fetching workflows from storage for triggering:", error);
          chrome.notifications.create(`trigger-storage-error-${Date.now()}`, {
             type: 'basic', iconUrl: 'icons/icon48.png',
             title: 'Storage Error', message: 'Could not load workflow configurations to trigger.'
          });
         return;
     }

    const workflow = workflows[workflowIndex];

    if (!workflow || !workflow.webhookUrl || !workflow.name) {
        console.error(`Workflow not found or invalid at index: ${workflowIndex}`, workflow);
        chrome.notifications.create(`trigger-wf-notfound-${Date.now()}`, {
             type: 'basic', iconUrl: 'icons/icon48.png',
             title: 'n8n Trigger Error',
             message: `Could not find a valid workflow for the selected menu item. It might have been deleted.`
        });
        return;
    }

    let urlObject;
    try {
        urlObject = new URL(workflow.webhookUrl);
    } catch (error) {
         console.error(`Invalid URL stored for workflow "${workflow.name}": ${workflow.webhookUrl}`, error);
         chrome.notifications.create(`trigger-url-invalid-${Date.now()}`, {
            type: 'basic', iconUrl: 'icons/icon48.png',
            title: 'n8n Trigger Error',
            message: `Invalid URL configured for workflow "${workflow.name}". Please check configuration.`
         });
         return;
    }
    const requiredOrigin = `${urlObject.protocol}//${urlObject.hostname}${urlObject.port ? ':' + urlObject.port : ''}/*`;

    chrome.permissions.contains({ origins: [requiredOrigin] }, async (hasPermission) => {
         if (chrome.runtime.lastError) {
              console.error(`Error during permissions.contains check: ${chrome.runtime.lastError.message}`);
              return;
         }
         if (!hasPermission) {
             console.error(`Permission check failed or denied for ${requiredOrigin}. Aborting.`);
             chrome.notifications.create(`trigger-perm-missing-${Date.now()}`, {
                 type: 'basic', iconUrl: 'icons/icon48.png',
                 title: 'Permission Missing',
                 message: `Missing permission to connect to ${urlObject.origin} for workflow "${workflow.name}". Please edit the workflow in options to grant permission.`
             });
             return; // Stoppt die Ausführung
         }

         const payload = {
             url: tab.url,
             pageTitle: tab.title,
             selectionText: info.selectionText || null,
             linkUrl: info.linkUrl || null,
             imageUrl: info.srcUrl || null
         };

         try {
             if (workflow.parameters && workflow.parameters.length > 0) {
                 const collectedParams = await getParametersFromUser(tab.id, workflow.parameters);

                  if (collectedParams === null) {
                      chrome.notifications.create(`trigger-param-cancel-${Date.now()}`, {
                         type: 'basic', iconUrl: 'icons/icon48.png',
                         title: 'Workflow Cancelled',
                         message: `Parameter input cancelled or failed for workflow "${workflow.name}".`
                      });
                      return; // Abort if null was returned
                  }
                  let requiredCheckFailed = false;
                  for (const paramDef of workflow.parameters) {
                     const value = collectedParams[paramDef.name];
                     if (paramDef.required && (value === null || value === undefined || value === '')) {
                         console.error(`Required parameter "${paramDef.name}" missing or empty in collected params. Aborting.`);
                         chrome.notifications.create(`trigger-param-req-${Date.now()}`, {
                            type: 'basic', iconUrl: 'icons/icon48.png',
                            title: 'Parameter Required',
                            message: `The required parameter "${paramDef.name}" was not provided for workflow "${workflow.name}". Trigger aborted.`
                         });
                         requiredCheckFailed = true;
                         break; // Exit loop early
                     }
                 }

                 if (requiredCheckFailed) {
                    return; // Stop processing if a required parameter was missing
                 }

                 Object.assign(payload, collectedParams);

             }

             const response = await fetch(workflow.webhookUrl, {
                 method: 'POST',
                 headers: {
                     'Content-Type': 'application/json',
                 },
                 body: JSON.stringify(payload)
             });

             if (!response.ok) {
                 let errorDetails = '(Could not parse error response body)';
                 try {
                    const contentType = response.headers.get("content-type");
                    if (contentType && contentType.includes("application/json")) {
                        const errorJson = await response.json();
                        errorDetails = JSON.stringify(errorJson);
                    } else {
                        errorDetails = await response.text();
                    }
                 } catch(e) { /* Keep default error message */ }

                 console.error(`Error triggering workflow ${workflow.name}: ${response.status} ${response.statusText}`, errorDetails);
                 chrome.notifications.create(`trigger-error-${response.status}-${Date.now()}`, {
                     type: 'basic', iconUrl: 'icons/icon48.png',
                     title: `n8n Trigger Error (${response.status})`,
                     message: `Failed "${workflow.name}". Server: ${errorDetails.substring(0, 150)}...`
                 });
             } else {
                 let responseData = '(No response body or not JSON)';
                 try {
                     const contentType = response.headers.get("content-type");
                      if (contentType && contentType.includes("application/json")) {
                         responseData = await response.json();
                      } else {
                         const textResponse = await response.text();
                         responseData = textResponse ? textResponse : '(Empty response body)';
                      }
                 } catch (e) { /* Keep default message */ }

                 chrome.notifications.create(`trigger-success-${Date.now()}`, {
                     type: 'basic', iconUrl: 'icons/icon48.png',
                     title: 'n8n Workflow Triggered',
                     message: `Workflow "${workflow.name}" was successfully triggered!`
                 });
             }

         } catch (error) {
             console.error(`Error during parameter handling or fetch:`, error);
             chrome.notifications.create(`trigger-network-error-${Date.now()}`,{
                 type: 'basic', iconUrl: 'icons/icon48.png',
                 title: 'n8n Trigger Network Error',
                 message: `Could not send request for "${workflow.name}". Error: ${error.message}`
             });
         }
     });
});

// Helper Function to Get Parameters via Scripting
async function getParametersFromUser(tabId, parameters) {
    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: collectParamsInPage, // Function defined below
            args: [parameters],         // Pass parameters to the function
            world: 'MAIN'               // Execute in the main world context
        });

        // Check if injection was successful and returned a result object
        if (results && results.length > 0 && results[0].result !== undefined) {
             // The script explicitly returns null if user cancelled a required prompt
            if (results[0].result === null) {
                 return null; // Propagate cancellation
             }
            return results[0].result; // Return the collected object (or empty object if no prompts)
        } else {
            chrome.notifications.create(`param-inject-fail-${Date.now()}`,{
                 type: 'basic', iconUrl: 'icons/icon48.png',
                 title: 'Parameter Input Error',
                 message: `Could not inject script into the page to ask for parameters.`
              });
            return null; // Indicate failure or cancellation
        }
    } catch (error) {
        console.error("Error injecting script via executeScript:", error);
          chrome.notifications.create(`param-inject-error-${Date.now()}`,{
             type: 'basic', iconUrl: 'icons/icon48.png',
             title: 'Parameter Input Error',
             message: `Could not display prompts on this page. Error: ${error.message}`
          });
        return null; // Indicate failure
    }
}

// IMPORTANT: This function is executed *in the context of the web page*.
function collectParamsInPage(parameters) {
    const collected = {};
    let cancelledDueToRequired = false;

    for (const param of parameters) {
        const promptMessage = `${param.name}${param.required ? ' (required)' : ' (optional)'}:`;
        const value = prompt(promptMessage);

        if (value === null) { // User clicked Cancel
            if (param.required) {
               alert(`Parameter "${param.name}" is required. Aborting workflow trigger.`);
               cancelledDueToRequired = true;
               break; // Stop asking for more parameters
            }
            collected[param.name] = null;
        } else {
            collected[param.name] = value; // Store the entered value
        }
    }

    if (cancelledDueToRequired) {
        return null;
    }
    return collected;
}


// --- Optional: Notification Permission Check on Install ---
chrome.runtime.onInstalled.addListener(() => {
    chrome.permissions.contains({ permissions: ['notifications'] }, (granted) => {
        if (granted) {
        } else {
            console.log("Notification permission not granted. Notifications might not work.");
        }
    });
});