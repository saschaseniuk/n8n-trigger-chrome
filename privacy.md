# Privacy Policy for "n8n Workflow Trigger" Chrome Extension

**Effective Date:** April 15, 2025  
**Author:** Sascha Seniuk  
**Website:** [aiscream.de](https://aiscream.de)

---

### 1. Overview

The **n8n Workflow Trigger** Chrome Extension values your privacy and is designed to be as secure and transparent as possible. This Privacy Policy outlines what data is collected, how it’s used, and what permissions the extension requests.

---

### 2. Data Collection

The extension **does not collect, transmit, or store any personal data** on external servers.

All configuration data — such as workflow names, webhook URLs, and parameters — is:

- Stored **locally** using `chrome.storage.sync`
- **Synchronized only across your Chrome profile** (if signed in and sync is enabled)

No data is ever sent to the developer or any third-party service.

---

### 3. Permissions Used

The extension requires the following permissions:

- `contextMenus`: To add the right-click trigger option
- `storage`: To save and load your workflow settings
- `scripting`: To prompt for additional parameters from the page
- `activeTab`: To access the current tab’s URL and title
- `notifications`: To inform you of successful or failed actions
- `optional_host_permissions`: To allow POST requests only to the specific webhook domains you approve

**Host permissions are requested only when saving a workflow**, and only for the specific domain you enter.

---

### 4. What Happens When You Trigger a Workflow

When you manually trigger a workflow from the context menu:

- A `POST` request is sent to the webhook URL you provided
- The request contains data from the current page, selected content, and any parameters you choose to enter
- This only happens **when you initiate it**
- You will be notified about success or failure via a Chrome notification

---

### 5. No Tracking or Analytics

This extension:

- Does **not track your activity**
- Does **not use any analytics tools**
- Does **not log** or monitor your browsing behavior

---

### 6. Open Source Transparency

This extension is **100% open source**. You can review the full code at:

> [GitHub Repository (insert link here)]()

---

### 7. Contact

If you have questions about privacy or the extension in general, feel free to contact:

**Sascha Seniuk**  
Website: [aiscream.de](https://aiscream.de)  
Email: [Insert your email if desired]

---

### 8. Changes to this Policy

If this Privacy Policy changes in the future, updates will be reflected in the GitHub repository and/or the Chrome Web Store listing. No silent changes will be made.