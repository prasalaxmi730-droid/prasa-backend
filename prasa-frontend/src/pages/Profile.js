import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/employeeUI.css";
import "../styles/profile.css";

const Profile = () => {
  const navigate = useNavigate();
  const [openMenu, setOpenMenu] = useState(false);
  const [employee, setEmployee] = useState(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const raw = localStorage.getItem("employee");
    if (!raw || raw === "undefined") {
      localStorage.removeItem("employee");
      navigate("/login");
      return;
    }

    try {
      setEmployee(JSON.parse(raw));
    } catch {
      localStorage.removeItem("employee");
      navigate("/login");
    }
  }, [navigate]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    if (hour < 21) return "Good Evening";
    return "Good Night";
  }, []);

  if (!employee) return null;

  const employeeName = employee.emp_name || "Employee";
  const empId = employee.emp_id || "N/A";
  const department = employee.department || "General";

  const logout = () => {
    localStorage.clear();
    navigate("/login");
  };

  return (
    <div className="employee-shell">
      <div className="employee-container">
        <div className="employee-header">
          <div className="employee-header-left">
            <button className="employee-btn" onClick={() => setOpenMenu(true)}>
              Menu
            </button>
            <h3 className="employee-brand">Precise HRMS</h3>
          </div>

          <div className="employee-header-right">
            <span className="employee-chip">{empId}</span>
            <button className="employee-btn" onClick={() => navigate("/history")}>
              Alerts
            </button>
            <button className="employee-btn" onClick={() => navigate("/ticket-system")}>
              Inbox
            </button>
            <button className="employee-btn employee-btn-primary" onClick={logout}>
              Logout
            </button>
          </div>
        </div>

        <div className="employee-nav">
          <button className="employee-nav-item active">Home</button>
          <button className="employee-nav-item" onClick={() => navigate("/expenses")}>
            Expenses
          </button>
          <button className="employee-nav-item" onClick={() => navigate("/ticket-system")}>
            Tickets
          </button>
          <button className="employee-nav-item" onClick={() => navigate("/dashboard")}>
            Profile
          </button>
        </div>

        {openMenu && (
          <div className="drawer-overlay" onClick={() => setOpenMenu(false)}>
            <div className="drawer" onClick={(e) => e.stopPropagation()}>
              <h4 className="drawer-title">Employee Settings</h4>
              <div className="drawer-item">
                <strong>Name:</strong> {employeeName}
              </div>
              <div className="drawer-item">
                <strong>Employee ID:</strong> {empId}
              </div>
              <div className="drawer-item">
                <strong>Department:</strong> {department}
              </div>
            </div>
          </div>
        )}

        <div className="employee-greeting-card">
          <p className="employee-greeting-title">{greeting}</p>
          <p className="employee-greeting-name">Hello, {employeeName}</p>
          <p className="employee-greeting-sub">
            Welcome back to your workspace portal.
          </p>
        </div>

        <div className="profile-time-card">
          <div className="profile-live-time">{now.toLocaleTimeString()}</div>
          <div className="profile-location">Prasa Employee Workspace</div>
          <div className="profile-signal">Network status: Connected</div>
          <div className="profile-attendance-actions">
            <button className="profile-check-btn in">Check In</button>
            <button className="profile-check-btn out">Check Out</button>
          </div>
        </div>

        <section className="workspace-section">
          <h4 className="workspace-title">MY WORKSPACE</h4>
          <div className="workspace-grid">
            <div className="workspace-card" onClick={() => navigate("/dashboard")}>
              <p className="workspace-card-title">Dashboard</p>
              <p className="workspace-card-sub">Employee profile details</p>
            </div>
            <div className="workspace-card" onClick={() => navigate("/expenses")}>
              <p className="workspace-card-title">Expenses</p>
              <p className="workspace-card-sub">Create and submit expense</p>
            </div>
            <div className="workspace-card" onClick={() => navigate("/ticket-system")}>
              <p className="workspace-card-title">Requests</p>
              <p className="workspace-card-sub">Raise ticket requests</p>
            </div>
            <div className="workspace-card" onClick={() => navigate("/history")}>
              <p className="workspace-card-title">History</p>
              <p className="workspace-card-sub">Submitted records</p>
            </div>
          </div>
        </section>

        <section className="workspace-section">
          <h4 className="workspace-title">COMPANY INFO</h4>
          <div className="workspace-grid">
            <div className="workspace-card">
              <p className="workspace-card-title">Policies</p>
              <p className="workspace-card-sub">Company policy updates</p>
            </div>
            <div className="workspace-card">
              <p className="workspace-card-title">Notices</p>
              <p className="workspace-card-sub">Latest office notices</p>
            </div>
            <div className="workspace-card" onClick={() => navigate("/graphs")}>
              <p className="workspace-card-title">Graphs</p>
              <p className="workspace-card-sub">Visual analytics view</p>
            </div>
            <div className="workspace-card">
              <p className="workspace-card-title">Support</p>
              <p className="workspace-card-sub">Helpdesk contacts</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Profile;
