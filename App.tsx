import React, { useState, useEffect, FormEvent } from 'react';
import axios from 'axios';

const API_BASE_URL = "http://localhost:8080/api/authorizations";

interface AuthorizationRequest {
  id: number;
  patientName: string;
  providerId: string;
  payerId: string;
  fhirResourceType: string;
  fhirPayload: string;
  status: 'DRAFT' | 'PENDING_PAYER' | 'APPROVED' | 'REJECTED';
  aiCopilotReview: string;
  aiPassed: boolean;
  payerNotes: string | null;
}

// User Schema for the Role Table
interface UserAccount {
  username: string;
  name: string;
  role: 'provider' | 'payer';
  organization: string;
}

function App() {
  const [requests, setRequests] = useState<AuthorizationRequest[]>([]);

  // --- CHANGED TO sessionSTORAGE: Holds data only for the duration of the page tab session ---
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    const savedUser = sessionStorage.getItem('currentUser');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [loginUsername, setLoginUsername] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>(''); // Mock password field

  // Mock Identity Database Table for System Users
  const userDatabaseTable: UserAccount[] = [
    { username: 'dr_smith', name: 'Dr. Sarah Smith', role: 'provider', organization: 'PROV-901 (General Clinic)' },
    { username: 'dr_jones', name: 'Dr. Robert Jones', role: 'provider', organization: 'PROV-702 (Neurology Center)' },
    { username: 'payer_admin', name: 'Alex Mercer (Adjudicator)', role: 'payer', organization: 'PAYER-MAX Network' },
  ];

  // Modal Control State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Clean User Form States
  const [editingRequestId, setEditingRequestId] = useState<number | null>(null);
  const [patientName, setPatientName] = useState<string>('');

  // --- CHANGED TO sessionSTORAGE: Dynamically fall back on tab refresh ---
  const [providerId, setProviderId] = useState<string>(() => {
    const savedUser = sessionStorage.getItem('currentUser');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      if (user.role === 'provider') return user.organization.split(' ')[0];
    }
    return 'PROV-901';
  });

  const [payerId, setPayerId] = useState<string>('PAYER-MAX');
  const [requestedProcedure, setRequestedProcedure] = useState<string>('MRI Lumbar Spine');
  const [diagnosisText, setDiagnosisText] = useState<string>('Low back pain, unspecified');
  const [diagnosisCode, setDiagnosisCode] = useState<string>('M54.50');

  // Payer Console Adjudication Notes
  const [actionNotes, setActionNotes] = useState<Record<number, string>>({});

  const fetchRequests = async () => {
    try {
      const response = await axios.get<AuthorizationRequest[]>(API_BASE_URL);
      setRequests(response.data);
    } catch (error) {
      console.error("Database tracking link failure:", error);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // Login Handler Logic
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();

    try {
      // Direct connection check against your real Spring Boot MySQL database
      const response = await axios.post("http://localhost:8080/api/auth/login", {
        username: loginUsername,
        password: loginPassword
      });

      const loggedInUser = response.data; // User Account data returned from backend

      // --- CHANGED TO sessionSTORAGE: Persist user to tab session storage ---
      sessionStorage.setItem('currentUser', JSON.stringify(loggedInUser));
      setCurrentUser(loggedInUser);

      if (loggedInUser.role === 'provider') {
        setProviderId(loggedInUser.organization.split(' ')[0]);
      }

      setLoginUsername('');
      setLoginPassword('');
    } catch (error) {
      console.error(error);
      alert("Authentication Failed: Invalid username or password record inside MySQL.");
    }
  };

  const handleLogout = () => {
    // --- CHANGED TO sessionSTORAGE: Clear storage explicitly on log out ---
    sessionStorage.removeItem('currentUser');
    setCurrentUser(null);
  };

  // Metric Calculation Engine
  const totalCount = requests.length;
  const pendingCount = requests.filter(r => r.status === 'PENDING_PAYER').length;
  const aiPassedCount = requests.filter(r => r.aiPassed).length;
  const aiPassRate = totalCount > 0 ? ((aiPassedCount / totalCount) * 100).toFixed(0) : 0;
  const approvedCount = requests.filter(r => r.status === 'APPROVED').length;
  const finalizedCount = requests.filter(r => r.status === 'APPROVED' || r.status === 'REJECTED').length;
  const approvalRate = finalizedCount > 0 ? ((approvedCount / finalizedCount) * 100).toFixed(0) : 0;

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRequestId(null);
    setPatientName('');
    setRequestedProcedure('MRI Lumbar Spine');
    setDiagnosisText('Low back pain, unspecified');
    setDiagnosisCode('M54.50');
  };

  const handleCreateDraft = async (e: FormEvent) => {
    e.preventDefault();

    const automatedFhirPayload = JSON.stringify({
      resourceType: "Claim",
      status: "active",
      use: "preauthorization",
      patient: { reference: `Patient/${patientName.toLowerCase().replace(/\s+/g, '-')}` },
      diagnosis: [
        {
          sequence: 1,
          diagnosisCodeableConcept: {
            coding: [{ system: "http://hl7.org/fhir/sid/icd-10", code: diagnosisCode }],
            text: diagnosisText
          }
        }
      ],
      item: [
        {
          sequence: 1,
          id: "1",
          productOrService: { text: requestedProcedure }
        }
      ]
    }, null, 2);

    try {
      const payload = { patientName, providerId, payerId, fhirPayload: automatedFhirPayload };

      if (editingRequestId) {
        await axios.put(`${API_BASE_URL}/${editingRequestId}/edit`, payload);
        alert(`Correction Lifecycle complete: Record #${editingRequestId} updated.`);
      } else {
        await axios.post(`${API_BASE_URL}/draft`, payload);
        alert("Success: Record created!");
      }

      handleCloseModal();
      await fetchRequests();
    } catch (error) {
      alert("Draft execution exception observed.");
    }
  };

  const handleTransmitting = async (id: number) => {
    try {
      await axios.put(`${API_BASE_URL}/${id}/submit`);
      await fetchRequests();
      alert(`Success: Prior-Auth Record #${id} transmitted to Payer.`);
    } catch (error) {
      alert("Error: Failed to transmit record.");
    }
  };

  const handlePayerResolution = async (id: number, decision: 'APPROVED' | 'REJECTED') => {
    try {
      const noteText = actionNotes[id] || '';
      await axios.put(`${API_BASE_URL}/${id}/payer-action?status=${decision}&notes=${encodeURIComponent(noteText)}`);

      setActionNotes(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });

      await fetchRequests();
      alert(`Adjudication Complete: Record #${id} has been ${decision.toLowerCase()}.`);
    } catch (error) {
      alert("Error: Failed to process adjudication request.");
    }
  };

  const handleTriggerCorrectionLoop = (req: AuthorizationRequest) => {
    setEditingRequestId(req.id);
    setPatientName(req.patientName);
    setProviderId(req.providerId);
    setPayerId(req.payerId);

    try {
      const parsed = JSON.parse(req.fhirPayload);
      if(parsed.item?.[0]?.productOrService?.text) setRequestedProcedure(parsed.item[0].productOrService.text);
      if(parsed.diagnosis?.[0]?.diagnosisCodeableConcept?.text) setDiagnosisText(parsed.diagnosis[0].diagnosisCodeableConcept.text);
      if(parsed.diagnosis?.[0]?.diagnosisCodeableConcept?.coding?.[0]?.code) setDiagnosisCode(parsed.diagnosis[0].diagnosisCodeableConcept.coding[0].code);
    } catch(e) {
      setRequestedProcedure('MRI Lumbar Spine');
    }

    setIsModalOpen(true);
  };

  // --- RENDERING GATE 1: LOGIN PORTAL SCREEN ---
  if (!currentUser) {
    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9', fontFamily: 'sans-serif', padding: '20px' }}>
          <div style={{ backgroundColor: '#fff', padding: '35px', borderRadius: '8px', width: '400px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginBottom: '25px' }}>
            <h2 style={{ textAlign: 'center', margin: '0 0 10px 0', color: '#2c3e50' }}>Clearinghouse Gate</h2>
            <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.85rem', marginBottom: '25px' }}>Secure Bidirectional Identity Access Control</p>

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '5px' }}>Username</label>
                <input type="text" placeholder="e.g. dr_smith or payer_admin" value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '5px' }}>Security Password</label>
                <input type="password" placeholder="••••••••" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
              </div>
              <button type="submit" style={{ backgroundColor: '#2c3e50', color: '#fff', border: 'none', padding: '12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}>
                Sign In to Environment
              </button>
            </form>
          </div>

          {/* MOCK USERS REGISTRY ROLE TABLE DIRECT VIEW */}
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', width: '550px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#475569', borderBottom: '1px solid #e2e8f0', paddingBottom: '5px' }}>📋 Authorization Registry Access Table (Testing Credentials)</h4>
            <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
              <tr style={{ background: '#f8fafc', color: '#64748b' }}>
                <th style={{ padding: '6px' }}>Username</th>
                <th style={{ padding: '6px' }}>Staff Name</th>
                <th style={{ padding: '6px' }}>System Access Role</th>
                <th style={{ padding: '6px' }}>Organization Unit</th>
              </tr>
              </thead>
              <tbody>
              {userDatabaseTable.map(u => (
                  <tr key={u.username} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '6px', fontWeight: 'bold', color: '#0284c7' }}>{u.username}</td>
                    <td style={{ padding: '6px' }}>{u.name}</td>
                    <td style={{ padding: '6px' }}>
                    <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', color: '#fff', backgroundColor: u.role === 'provider' ? '#3498db' : '#2ecc71' }}>
                      {u.role.toUpperCase()}
                    </span>
                    </td>
                    <td style={{ padding: '6px', color: '#64748b' }}>{u.organization}</td>
                  </tr>
              ))}
              </tbody>
            </table>
          </div>
        </div>
    );
  }

  // --- RENDERING GATE 2: SECURED APPLICATION WORKSPACE ---
  return (
      <div style={{ padding: '25px', fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif', backgroundColor: '#fdfdfd', color: '#333', maxWidth: '1300px', margin: '0 auto' }}>

        {/* SECURED WORKSPACE NAVIGATION BANNER */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px solid #2c3e50', paddingBottom: '15px', marginBottom: '25px' }}>
          <div>
            <h1 style={{ margin: 0, color: '#2c3e50', fontSize: '1.8rem' }}>Smart Healthcare Connector</h1>
            <p style={{ margin: '5px 0 0 0', color: '#7f8c8d', fontSize: '0.95rem' }}>Secured Environment Workspace</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>

            {/* Contextual UI buttons locked to current user role schema */}
            {currentUser.role === 'provider' && (
                <button onClick={() => setIsModalOpen(true)} style={{ padding: '10px 20px', borderRadius: '4px', border: 'none', fontWeight: 'bold', cursor: 'pointer', backgroundColor: '#e74c3c', color: '#fff' }}>
                  + Initiate Prior-Auth
                </button>
            )}

            <div style={{ padding: '5px 12px', borderLeft: '3px solid #cbd5e1', textAlign: 'right' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>{currentUser.name}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Role: <span style={{ fontWeight: 'bold', color: currentUser.role === 'provider' ? '#3498db' : '#2ecc71' }}>{currentUser.role.toUpperCase()}</span></div>
            </div>

            <button onClick={handleLogout} style={{ padding: '8px 12px', background: '#64748b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>
              Sign Out
            </button>
          </div>
        </header>

        {/* DASHBOARD ANALYTICS PANEL */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '25px' }}>
          <div style={{ backgroundColor: '#ffffff', padding: '15px', borderRadius: '6px', borderLeft: '5px solid #34495e', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '0.85rem', color: '#7f8c8d', fontWeight: 'bold', textTransform: 'uppercase' }}>Total Volume</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 'bold', marginTop: '5px', color: '#2c3e50' }}>{totalCount} Requests</div>
          </div>
          <div style={{ backgroundColor: '#ffffff', padding: '15px', borderRadius: '6px', borderLeft: '5px solid #f1c40f', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '0.85rem', color: '#7f8c8d', fontWeight: 'bold', textTransform: 'uppercase' }}>Awaiting Review</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 'bold', marginTop: '5px', color: '#f39c12' }}>{pendingCount} Outstanding</div>
          </div>
          <div style={{ backgroundColor: '#ffffff', padding: '15px', borderRadius: '6px', borderLeft: '5px solid #9b59b6', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '0.85rem', color: '#7f8c8d', fontWeight: 'bold', textTransform: 'uppercase' }}>AI Pass Rate</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 'bold', marginTop: '5px', color: '#8e44ad' }}>{aiPassRate}%</div>
          </div>
          <div style={{ backgroundColor: '#ffffff', padding: '15px', borderRadius: '6px', borderLeft: '5px solid #2ecc71', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '0.85rem', color: '#7f8c8d', fontWeight: 'bold', textTransform: 'uppercase' }}>Approval Rating</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 'bold', marginTop: '5px', color: '#27ae60' }}>{approvalRate}%</div>
          </div>
        </section>

        {/* POPUP MODAL ENGINES */}
        {isModalOpen && currentUser.role === 'provider' && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
              <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '8px', width: '550px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
                <h3 style={{ margin: '0 0 20px 0', color: '#2c3e50', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                  {editingRequestId ? `📝 Edit Authorization Request #${editingRequestId}` : '📋 New Prior-Authorization Entry Form'}
                </h3>

                <form onSubmit={handleCreateDraft} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: '600', display: 'block', marginBottom: '5px' }}>Patient Full Name</label>
                    <input type="text" value={patientName} onChange={(e) => setPatientName(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div>
                      <label style={{ fontSize: '0.85rem', fontWeight: '600', display: 'block', marginBottom: '5px' }}>Provider ID Context</label>
                      <input type="text" value={providerId} readOnly style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box', backgroundColor: '#f1f5f9' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.85rem', fontWeight: '600', display: 'block', marginBottom: '5px' }}>Target Payer Code</label>
                      <input type="text" value={payerId} onChange={(e) => setPayerId(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: '600', display: 'block', marginBottom: '5px' }}>Requested Medical Procedure</label>
                    <input type="text" value={requestedProcedure} onChange={(e) => setRequestedProcedure(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '15px' }}>
                    <div>
                      <label style={{ fontSize: '0.85rem', fontWeight: '600', display: 'block', marginBottom: '5px' }}>Clinical Diagnosis Context</label>
                      <input type="text" value={diagnosisText} onChange={(e) => setDiagnosisText(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.85rem', fontWeight: '600', display: 'block', marginBottom: '5px' }}>ICD-10 Code</label>
                      <input type="text" value={diagnosisCode} onChange={(e) => setDiagnosisCode(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '15px', borderTop: '1px solid #e2e8f0', paddingTop: '15px' }}>
                    <button type="button" onClick={handleCloseModal} style={{ padding: '10px 15px', background: '#94a3b8', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                    <button type="submit" style={{ padding: '10px 20px', background: '#2c3e50', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                      {editingRequestId ? "Save Corrections" : "Run AI Review & Save"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
        )}

        {/* MAIN DATA TRACKING MATRIX TABLE VIEWPORT */}
        <section style={{ backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          <div style={{ padding: '15px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, color: '#2c3e50' }}>Audit Clearinghouse Exchange Tracker</h3>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Viewing context locked as: <strong>{currentUser.role.toUpperCase()} MODE</strong></span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
            <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '0.9rem' }}>
              <th style={{ padding: '12px 20px' }}>ID</th>
              <th style={{ padding: '12px 20px' }}>Patient Entity</th>
              <th style={{ padding: '12px 20px' }}>Routing Profile</th>
              <th style={{ padding: '12px 20px' }}>Workflow Status</th>
              <th style={{ padding: '12px 20px' }}>AI Copilot Log</th>
              <th style={{ padding: '12px 20px' }}>Payer Determination Log</th>
              <th style={{ padding: '12px 20px', textAlign: 'center' }}>Available Operations Actions</th>
            </tr>
            </thead>
            <tbody>
            {requests.map((req) => (
                <tr key={req.id} style={{ borderBottom: '1px solid #e2e8f0', fontSize: '0.95rem', verticalAlign: 'middle' }}>
                  <td style={{ padding: '15px 20px', fontWeight: 'bold', color: '#64748b' }}>#{req.id}</td>
                  <td style={{ padding: '15px 20px', fontWeight: '600' }}>{req.patientName}</td>
                  <td style={{ padding: '15px 20px', color: '#475569', fontSize: '0.85rem' }}>
                    <strong>From:</strong> {req.providerId}<br />
                    <strong>To:</strong> {req.payerId}
                  </td>
                  <td style={{ padding: '15px 20px' }}>
                    <span style={{ padding: '5px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', color: '#fff', backgroundColor: req.status === 'APPROVED' ? '#2ecc71' : req.status === 'REJECTED' ? '#e74c3c' : req.status === 'PENDING_PAYER' ? '#f1c40f' : '#7f8c8d' }}>
                      {req.status}
                    </span>
                  </td>
                  <td style={{ padding: '15px 20px', width: '25%', fontSize: '0.85rem', backgroundColor: req.aiPassed ? '#f0fdf4' : '#fffbeb', color: req.aiPassed ? '#166534' : '#9a3412' }}>
                    <strong>[{req.aiPassed ? "VALID" : "ACTION REQUIRED"}]:</strong> {req.aiCopilotReview}
                  </td>
                  <td style={{ padding: '15px 20px', color: '#64748b', fontStyle: 'italic', fontSize: '0.85rem' }}>
                    {req.payerNotes ? `"${req.payerNotes}"` : <span style={{ color: '#cbd5e1' }}>No comments recorded</span>}
                  </td>
                  <td style={{ padding: '15px 20px', textAlign: 'center' }}>

                    {/* Locked Actions: Provider Operations */}
                    {currentUser.role === 'provider' && req.status === 'DRAFT' && (
                        <button onClick={() => handleTransmitting(req.id)} style={{ backgroundColor: '#3498db', color: '#fff', padding: '6px 14px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                          Transmit to Payer
                        </button>
                    )}

                    {currentUser.role === 'provider' && req.status === 'REJECTED' && (
                        <button onClick={() => handleTriggerCorrectionLoop(req)} style={{ backgroundColor: '#e67e22', color: '#fff', padding: '6px 14px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                          Edit & Fix
                        </button>
                    )}

                    {/* Locked Actions: Payer Adjudication Operations */}
                    {currentUser.role === 'payer' && req.status === 'PENDING_PAYER' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: '160px' }}>
                          <input type="text" placeholder="Add formal remarks..." value={actionNotes[req.id] || ''} onChange={(e) => setActionNotes(prev => ({ ...prev, [req.id]: e.target.value }))} style={{ padding: '6px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button onClick={() => handlePayerResolution(req.id, 'APPROVED')} style={{ backgroundColor: '#2ecc71', color: '#fff', border: 'none', padding: '5px 8px', borderRadius: '4px', cursor: 'pointer', flex: 1, fontWeight: 'bold', fontSize: '0.8rem' }}>Approve</button>
                            <button onClick={() => handlePayerResolution(req.id, 'REJECTED')} style={{ backgroundColor: '#e74c3c', color: '#fff', border: 'none', padding: '5px 8px', borderRadius: '4px', cursor: 'pointer', flex: 1, fontWeight: 'bold', fontSize: '0.8rem' }}>Reject</button>
                          </div>
                        </div>
                    )}

                    {/* Passive Views for non-actionable elements */}
                    {req.status === 'APPROVED' && <span style={{ color: '#27ae60', fontSize: '0.85rem', fontWeight: 'bold' }}>Archived</span>}
                    {currentUser.role === 'payer' && req.status === 'REJECTED' && <span style={{ color: '#e74c3c', fontSize: '0.85rem', fontWeight: 'bold' }}>Rejected</span>}
                    {currentUser.role === 'payer' && req.status === 'DRAFT' && <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Awaiting Provider</span>}
                    {currentUser.role === 'provider' && req.status === 'PENDING_PAYER' && <span style={{ color: '#f39c12', fontSize: '0.85rem' }}>In Payer Review</span>}
                  </td>
                </tr>
            ))}
            </tbody>
          </table>
        </section>
      </div>
  );
}

export default App;