# 🚀 n8n Workflow Trigger — Chrome Extension

Trigger your [n8n](https://n8n.io) workflows directly from the browser context menu — using data from the current web page, selected text, images, or links. A powerful automation booster for developers, analysts, marketers, and productivity geeks.

---

### 🧩 What This Extension Does

This extension allows you to:

- 📋 **Create multiple n8n workflows** with custom names, webhook URLs, and optional parameters.
- 🖱️ **Trigger them via right-click** from any web page, selection, image, or link.
- 🌐 **Automatically send metadata** from the page (like URL, selection, link/image) to your workflow.
- 🧠 **Prompt for additional parameters** when required.
- 🔐 **Request host permissions dynamically** — only when needed, keeping your browsing secure and private.

---

### 📸 Example Use Cases

- 🔍 Right-click on selected text and send it to ChatGPT or an AI model via n8n.
- 🌐 Trigger a Notion or Google Sheet automation with the current page URL.
- 🖼️ Send an image or link to your custom asset pipeline.
- 🧾 Collect research notes or links with context to your own database or knowledge base.

---

### 🛠️ How It Works

#### 1. **Manage Workflows**
Open the extension popup and click **Manage Workflows** to:
- Add a new workflow with:
  - A name
  - A valid n8n webhook URL
  - Optional parameters (with optional "required" flag)
- Edit or delete existing workflows

#### 2. **Permission Handling**
When saving a workflow, the extension checks if it has permission to access the webhook domain. If not, it requests permission from you.

Only approved origins can be triggered — no data is sent elsewhere.

#### 3. **Right-Click to Trigger**
Once a workflow is saved:
- Right-click on a page, selection, image, or link
- Choose **"Trigger n8n Workflow"** → your workflow name
- If the workflow has parameters, you’ll be prompted for them
- A `POST` request is sent to the webhook with a JSON payload like:

```json
{
  "url": "https://example.com",
  "pageTitle": "Example Page",
  "selectionText": "Highlighted text",
  "linkUrl": "https://link.com",
  "imageUrl": "https://image.com/img.png",
  "customParam1": "user input",
  "customParam2": "another input"
}
```

#### 4. **Notification Feedback**
You'll receive browser notifications for:
- Successful trigger
- Missing/invalid parameters
- Webhook/network errors
- Permission issues

---

### 🔒 Privacy & Permissions

This extension uses the following permissions:

| Permission         | Purpose |
|--------------------|---------|
| `storage`          | Save your workflows locally |
| `contextMenus`     | Add trigger options to right-click menu |
| `notifications`    | Show success or error messages |
| `scripting`        | Prompt you for parameters on the current page |
| `activeTab`        | Get page URL/title |
| `optional_host_permissions` | Ask permission per webhook domain |

🔐 **No data is sent anywhere unless you explicitly trigger a workflow.**

---

### 📦 Installation

1. Download or clone this repository
2. Open `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension folder
5. Start adding workflows!

---

### 💡 Tips

- Use `*` in parameter names to mark required fields (e.g. `email*`)
- You can edit permissions anytime by editing and re-saving a workflow
- Test your webhook URLs with Postman or directly in n8n

---

### 🧑‍💻 Developer Info

- Author: [Sascha Seniuk](https://aiscream.de)
- Manifest V3 Chrome Extension
- Data is stored via `chrome.storage.sync` (syncs across Chrome profile)

---

### 📃 License

MIT — feel free to fork, modify, or contribute!