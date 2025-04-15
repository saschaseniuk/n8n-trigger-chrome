const workflowListDiv = document.getElementById('workflowList');
const workflowForm = document.getElementById('workflowForm');
const workflowIdInput = document.getElementById('workflowId');
const workflowNameInput = document.getElementById('workflowName');
const webhookUrlInput = document.getElementById('webhookUrl');
const parametersContainer = document.getElementById('parametersContainer');
const addParameterBtn = document.getElementById('addParameterBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');

let workflows = []; // Array to hold the workflows

// --- Parameter Handling ---
function addParameterField(param = { name: '', required: false }) {
    const paramId = `param-${Date.now()}-${Math.random()}`; // Unique ID
    const div = document.createElement('div');
    div.classList.add('parameter-item');
    div.dataset.paramId = paramId;
    div.innerHTML = `
        <label for="paramName-${paramId}">Parameter Name:</label>
        <input type="text" id="paramName-${paramId}" value="${param.name || ''}" placeholder="e.g., prompt" required>
        <label>
            <input type="checkbox" id="paramRequired-${paramId}" ${param.required ? 'checked' : ''}> Required
        </label>
        <button type="button" class="removeParamBtn" data-target="${paramId}">Remove</button>
    `;
    parametersContainer.appendChild(div);

    div.querySelector('.removeParamBtn').addEventListener('click', () => {
        div.remove();
    });
}

addParameterBtn.addEventListener('click', () => addParameterField());

// --- Workflow CRUD ---
async function loadWorkflows() {
    const result = await chrome.storage.sync.get(['workflows']);
    workflows = result.workflows || [];
    displayWorkflows();
    // Important: Inform the background script to update the context menus!
    chrome.runtime.sendMessage({ action: "updateContextMenu" }).catch(error => {
        // Ignore errors if the background script is not yet ready (e.g., when the options page is first loaded)
        if (error.message.includes("Could not establish connection") || error.message.includes("Receiving end does not exist")) {
          console.log("Background script likely not ready yet, context menu update skipped.");
        } else {
          console.error("Error sending updateContextMenu message:", error);
        }
      });
}

function displayWorkflows() {
    workflowListDiv.innerHTML = ''; // Clear list
    workflows.forEach((wf, index) => {
        const div = document.createElement('div');
        div.classList.add('workflow-item');
        div.innerHTML = `
            <span>
                <strong>${wf.name}</strong><br>
                <small>${wf.webhookUrl}</small>
                ${wf.parameters && wf.parameters.length > 0 ? `<br><small>Params: ${wf.parameters.map(p => p.name + (p.required ? '*' : '')).join(', ')}</small>` : ''}
            </span>
            <span class="workflow-actions">
                <button data-index="${index}" class="editBtn">Edit</button>
                <button data-index="${index}" class="deleteBtn">Delete</button>
            </span>
        `;
        workflowListDiv.appendChild(div);
    });

    // Add event listeners for edit/delete buttons
    document.querySelectorAll('.editBtn').forEach(btn => {
        btn.addEventListener('click', handleEdit);
    });
    document.querySelectorAll('.deleteBtn').forEach(btn => {
        btn.addEventListener('click', handleDelete);
    });
}

function handleEdit(event) {
    const index = event.target.dataset.index;
    const wf = workflows[index];

    workflowIdInput.value = index; // Store index for saving
    workflowNameInput.value = wf.name;
    webhookUrlInput.value = wf.webhookUrl;

    // Clear and populate parameters
    parametersContainer.innerHTML = '';
    if (wf.parameters) {
        wf.parameters.forEach(param => addParameterField(param));
    }

    cancelEditBtn.style.display = 'inline-block';
    workflowForm.scrollIntoView();
}

async function handleDelete(event) {
    const index = event.target.dataset.index;
    if (confirm(`Are you sure you want to delete the workflow "${workflows[index].name}"?`)) {
        workflows.splice(index, 1);
        await chrome.storage.sync.set({ workflows: workflows });
        loadWorkflows(); // Reload list and update context menu via message
    }
}

function resetForm() {
    workflowForm.reset();
    workflowIdInput.value = '';
    parametersContainer.innerHTML = '';
    cancelEditBtn.style.display = 'none';
    // Ensure newly added parameter fields are cleared if reset is hit after adding some
    const tempParams = parametersContainer.querySelectorAll('.parameter-item');
    tempParams.forEach(p => p.remove());
}


cancelEditBtn.addEventListener('click', resetForm);

// Helper function to request permission
function requestPermission(origin) {
  return new Promise((resolve, reject) => {
    chrome.permissions.request({ origins: [origin] }, (granted) => {
      if (chrome.runtime.lastError) {
        // Error during the request (rare, but possible)
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(granted); // Returns true (granted) or false (rejected)
      }
    });
  });
}

// CUSTOM Submit Function
workflowForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = workflowNameInput.value.trim();
    const webhookUrlValue = webhookUrlInput.value.trim();
    const id = workflowIdInput.value; // Index if editing, empty if adding

    // 1. Validate and Parse the URL
    let urlObject;
    try {
        urlObject = new URL(webhookUrlValue);
        if (!['http:', 'https:'].includes(urlObject.protocol)) {
            throw new Error("Invalid protocol. Only http: and https: are supported.");
        }
        // Basic check for hostname presence
        if (!urlObject.hostname || urlObject.hostname.includes('..')) {
             throw new Error("Invalid hostname.");
        }

    } catch (error) {
        alert(`Invalid Webhook URL: ${error.message}`);
        return; // Stops the function
    }

    // IMPORTANT: The origin string must have the pattern "*://hostname:[port]/*"
    const requiredOrigin = `${urlObject.protocol}//${urlObject.hostname}${urlObject.port ? ':' + urlObject.port : ''}/*`;

    console.log("Required Origin for Permission:", requiredOrigin);

    // 2. Check permission
    chrome.permissions.contains({ origins: [requiredOrigin] }, async (hasPermission) => {
      if (chrome.runtime.lastError) {
          console.error("Error checking permissions:", chrome.runtime.lastError.message);
          alert(`Error checking permissions: ${chrome.runtime.lastError.message}`);
          return;
      }

      let permissionGranted = hasPermission;

      // 3. If no permission, request it
      if (!hasPermission) {
        console.log(`Permission for ${requiredOrigin} not found. Requesting...`);
        try {
          // Inform user before the native prompt appears
          alert(`This extension needs permission to connect to "${urlObject.origin}" to trigger the workflow. Please approve the upcoming request.`);
          permissionGranted = await requestPermission(requiredOrigin);
        } catch (error) {
          console.error("Error requesting permission:", error);
          alert(`Could not request permission: ${error.message}`);
          return; // Stops the function
        }
      }

      // 4. Only save if permission was granted
      if (permissionGranted) {
        console.log(`Permission granted for ${requiredOrigin}. Proceeding to save.`);

        // Collect parameters from the form
        const parameters = [];
        document.querySelectorAll('.parameter-item').forEach(item => {
            const paramId = item.dataset.paramId;
            const paramNameInput = document.getElementById(`paramName-${paramId}`);
            const paramRequiredInput = document.getElementById(`paramRequired-${paramId}`);
            // Only add if name is not empty and inputs exist
            if (paramNameInput && paramNameInput.value.trim() && paramRequiredInput) {
                parameters.push({
                    name: paramNameInput.value.trim(),
                    required: paramRequiredInput.checked
                });
            } else if(paramNameInput && paramNameInput.value.trim()){
                 // Fallback if checkbox somehow missing, assume not required
                 parameters.push({
                    name: paramNameInput.value.trim(),
                    required: false
                });
            }
        });

        const newWorkflow = { name, webhookUrl: webhookUrlValue, parameters };

        if (id !== '' && workflows[id]) { // Editing existing workflow
            workflows[id] = newWorkflow;
        } else { // Adding new workflow or ID was invalid
            workflows.push(newWorkflow);
        }

        try {
            await chrome.storage.sync.set({ workflows: workflows });
            resetForm();
            loadWorkflows(); // Reload list and update context menu via message
            // Success notification
             chrome.notifications.create(`save-success-${Date.now()}`, { // Unique ID for notification
                type: 'basic', iconUrl: '../icons/icon48.png', // Adjust path relative to options page
                title: 'Workflow Saved', message: `Workflow "${name}" saved successfully.`
             });
        } catch (error) {
            console.error("Error saving workflow to storage:", error);
            alert("Error saving workflow. Check console for details.");
        }

      } else {
        // Permission was denied by the user
        console.log(`Permission denied for ${requiredOrigin}. Workflow NOT saved.`);
        alert(`Permission for "${urlObject.origin}" was denied. The workflow could not be saved.`);
      }
    }); // End of chrome.permissions.contains callback
});

// Initial load
loadWorkflows();