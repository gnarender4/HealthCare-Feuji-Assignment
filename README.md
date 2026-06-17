# HealthCare-Feuji-Assignment



github Id : gnarender4

emailId : narendergude161@gmail.com

Name : Gude Narender





## 🔑 Testing Credentials

| Username | Password | Role | Organization Unit |
| :--- | :--- | :--- | :--- |
| **`dr_smith`** | `password123` | **PROVIDER** | PROV-901 Clinic |
| **`dr_jones`** | `password123` | **PROVIDER** | PROV-702 Center |
| **`payer_admin`** | `admin456` | **PAYER** | PAYER-MAX Network |

---

## 🔄 Core Application Workflow

The system manages a role-based prior-authorization lifecycle with automated AI compliance checks and persistent session tracking via `sessionStorage`.

### 1. Provider Submission & AI Interception
* **Action:** Log in as **`dr_smith`** and click **`+ Initiate Prior-Auth`**.
* **AI Validation Test:** Input a mismatched clinical scenario (e.g., *Procedure:* `X-Ray Hand` | *Diagnosis:* `Brain Hemorrhage`). 
* **Expected Result:** The backend AI rules engine catches the clinical mismatch, marks the request status as `DRAFT`, and flags it as `[ACTION REQUIRED]`, blocking it from being sent to the insurer.

### 2. Lifecyle Transmission
* **Action:** Click **`Edit & Fix`** on the draft request and correct the clinical discrepancy (e.g., aligning data to a logical procedure like `MRI Lumbar Spine`).
* **Expected Result:** Once data rules pass validation, the **`Transmit to Payer`** button unlocks. Clicking it updates the workflow track status to `PENDING_PAYER`.

### 3. Payer Adjudication Audit Trail
* **Action:** Sign out of the provider account and log back in using the **`payer_admin`** credentials.
* **Expected Result:** The workspace automatically switches to the insurance adjudication view. The reviewer can input official clinical audit remarks into the pending case file and select **`Approve`** or **`Reject`** to permanently finalize the record status.
