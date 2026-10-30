import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock3,
  CalendarDays,
  Search,
  RefreshCw,
  Eye,
  FileText,
  UserRound,
  Building2,
  AlertCircle,
  X,
  Check,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../api/api";
import "./CEOLeaveManagement.css";
import PageHeader from "../components/PageHeader";


const FILTERS = [
  { label: "Pending", value: "pending", icon: Clock3 },
  { label: "Approved", value: "approved", icon: CheckCircle2 },
  { label: "Rejected", value: "rejected", icon: XCircle },
];

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getRequestId = (request) =>
  request?._id || request?.id;

const getEmployeeName = (request) => {
  const employee =
    request?.employeeId ||
    request?.userId ||
    request?.employee ||
    request?.user;

  if (typeof employee === "string") {
    return request?.employeeName || "Employee";
  }

  return (
    employee?.name ||
    request?.employeeName ||
    request?.name ||
    "Employee"
  );
};

const getEmployeeEmail = (request) => {
  const employee =
    request?.employeeId ||
    request?.userId ||
    request?.employee ||
    request?.user;

  return typeof employee === "object"
    ? employee?.email || ""
    : request?.employeeEmail || "";
};

const getEmployeeRole = (request) => {
  const employee =
    request?.employeeId ||
    request?.userId ||
    request?.employee ||
    request?.user;

  return typeof employee === "object"
    ? employee?.role || request?.role || "hr"
    : request?.role || "hr";
};

const getEmployeeDepartment = (request) => {
  const employee =
    request?.employeeId ||
    request?.userId ||
    request?.employee ||
    request?.user;

  return (
    request?.department ||
    (typeof employee === "object" ? employee?.department : "") ||
    "—"
  );
};

const getLeaveType = (request) =>
  request?.leaveType ||
  request?.type ||
  request?.category ||
  "Leave";

const getStartDate = (request) =>
  request?.startDate ||
  request?.fromDate ||
  request?.from ||
  request?.date;

const getEndDate = (request) =>
  request?.endDate ||
  request?.toDate ||
  request?.to ||
  request?.startDate ||
  request?.fromDate;

const getReason = (request) =>
  request?.reason ||
  request?.description ||
  request?.leaveReason ||
  "No reason provided.";

const getRequestStatus = (request) =>
  String(request?.status || "pending").toLowerCase();

const getStatusLabel = (status) => {
  const normalized = String(status || "pending").toLowerCase();

  if (normalized === "approved") return "Approved";
  if (normalized === "rejected") return "Rejected";

  return "Pending";
};

const extractRequests = (response) => {
  if (Array.isArray(response)) return response;

  if (Array.isArray(response?.leaves)) return response.leaves;
  if (Array.isArray(response?.requests)) return response.requests;
  if (Array.isArray(response?.data)) return response.data;

  return [];
};

export default function CEOLeaveManagement() {
  const { token } = useAuth();

  const [activeFilter, setActiveFilter] = useState("pending");
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [selectedRequest, setSelectedRequest] = useState(null);
  const [reviewAction, setReviewAction] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadRequests = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const response = await apiRequest(
          `/api/leaves?status=${encodeURIComponent(activeFilter)}`,
          {},
          token
        );

        setRequests(extractRequests(response));
      } catch (requestError) {
        setError(
          requestError.message ||
            "Leave requests load nahi ho sakin."
        );
        setRequests([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeFilter, token]
  );

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();

    return requests.filter((request) => {
      const name = getEmployeeName(request).toLowerCase();
      const email = getEmployeeEmail(request).toLowerCase();
      const department = getEmployeeDepartment(request).toLowerCase();
      const leaveType = getLeaveType(request).toLowerCase();

      return (
        !query ||
        name.includes(query) ||
        email.includes(query) ||
        department.includes(query) ||
        leaveType.includes(query)
      );
    });
  }, [requests, search]);

  const counts = useMemo(() => {
    return {
      pending: requests.filter(
        (item) => getRequestStatus(item) === "pending"
      ).length,
      approved: requests.filter(
        (item) => getRequestStatus(item) === "approved"
      ).length,
      rejected: requests.filter(
        (item) => getRequestStatus(item) === "rejected"
      ).length,
    };
  }, [requests]);

  const openReview = (request, action) => {
    setSelectedRequest(request);
    setReviewAction(action);
    setRejectionReason("");
    setReviewComment("");
    setError("");
    setNotice("");
  };

  const closeReview = () => {
    if (submitting) return;

    setSelectedRequest(null);
    setReviewAction("");
    setRejectionReason("");
    setReviewComment("");
  };

  const submitReview = async (event) => {
    event.preventDefault();

    if (!selectedRequest || !token) return;

    if (reviewAction === "rejected" && !rejectionReason.trim()) {
      setError("Reject karne ke liye reason dena zaroori hai.");
      return;
    }

    const requestId = getRequestId(selectedRequest);

    if (!requestId) {
      setError("Is leave request ki ID nahi mil saki.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await apiRequest(
        `/api/leaves/${requestId}/review`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: reviewAction,
            ...(reviewAction === "rejected"
              ? { rejectionReason: rejectionReason.trim() }
              : {}),
            ...(reviewComment.trim()
              ? { comment: reviewComment.trim() }
              : {}),
          }),
        },
        token
      );

      setSelectedRequest(null);
      setReviewAction("");
      setRejectionReason("");
      setReviewComment("");

      setNotice(
        reviewAction === "approved"
          ? "Leave request successfully approve ho gayi."
          : "Leave request reject kar di gayi."
      );

      await loadRequests(true);
    } catch (requestError) {
      setError(
        requestError.message ||
          "Leave request review nahi ho saki."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const selectedName = selectedRequest
    ? getEmployeeName(selectedRequest)
    : "";

 return (
  <div className="ceo-leave-page">
    <PageHeader
      eyebrow="CEO WORKSPACE"
      title="Leave Management"
      description="Review HR leave requests and manage approval decisions."
      icon={CalendarDays}
      onRefresh={() => loadRequests(true)}
      refreshing={refreshing}
    />

      {notice && (
        <div className="ceo-leave-notice" role="status">
          <CheckCircle2 size={18} />
          <span>{notice}</span>

          <button
            type="button"
            onClick={() => setNotice("")}
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {error && !selectedRequest && (
        <div className="ceo-leave-error" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>

          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Dismiss error"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <section className="ceo-leave-stats">
        <article className="ceo-leave-stat">
          <div className="ceo-leave-stat-icon pending">
            <Clock3 size={21} />
          </div>

          <div>
            <span>Pending Requests</span>
            <strong>
              {activeFilter === "pending" ? requests.length : "—"}
            </strong>
          </div>
        </article>

        <article className="ceo-leave-stat">
          <div className="ceo-leave-stat-icon approved">
            <CheckCircle2 size={21} />
          </div>

          <div>
            <span>Approved Requests</span>
            <strong>
              {activeFilter === "approved" ? requests.length : "—"}
            </strong>
          </div>
        </article>

        <article className="ceo-leave-stat">
          <div className="ceo-leave-stat-icon rejected">
            <XCircle size={21} />
          </div>

          <div>
            <span>Rejected Requests</span>
            <strong>
              {activeFilter === "rejected" ? requests.length : "—"}
            </strong>
          </div>
        </article>
      </section>

      <section className="ceo-leave-content">
        <div className="ceo-leave-toolbar">
          <div className="ceo-leave-tabs">
            {FILTERS.map(({ label, value, icon: Icon }) => (
              <button
                type="button"
                key={value}
                className={
                  activeFilter === value
                    ? "ceo-leave-tab active"
                    : "ceo-leave-tab"
                }
                onClick={() => {
                  setActiveFilter(value);
                  setSearch("");
                  setError("");
                  setNotice("");
                }}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>

          <label className="ceo-leave-search">
            <Search size={17} />

            <input
              type="search"
              placeholder="Search name, department..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>

        <div className="ceo-leave-table-heading">
          <div>
            <h2>{FILTERS.find((item) => item.value === activeFilter)?.label} Leave Requests</h2>
            <p>
              {filteredRequests.length}{" "}
              {filteredRequests.length === 1 ? "request" : "requests"} found
            </p>
          </div>
        </div>

        {loading ? (
          <div className="ceo-leave-state">
            <RefreshCw size={25} className="ceo-leave-spin" />
            <h3>Loading leave requests</h3>
            <p>Please wait while we retrieve the latest requests.</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="ceo-leave-state">
            <div className="ceo-leave-empty-icon">
              <FileText size={27} />
            </div>

            <h3>No leave requests found</h3>

            <p>
              {search
                ? "Try another search term."
                : `There are no ${activeFilter} leave requests to display.`}
            </p>

            {search && (
              <button
                type="button"
                className="ceo-leave-clear-search"
                onClick={() => setSearch("")}
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="ceo-leave-table-wrap">
            <table className="ceo-leave-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Leave Type</th>
                  <th>Leave Dates</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredRequests.map((request) => {
                  const id = getRequestId(request);
                  const status = getRequestStatus(request);
                  const employeeName = getEmployeeName(request);
                  const startDate = getStartDate(request);
                  const endDate = getEndDate(request);
                const duration =
  request?.requestedDays ??
  request?.totalDays ??
  request?.days ??
  request?.duration ??
  null;

                  return (
                    <tr key={id}>
                      <td>
                        <div className="ceo-leave-employee">
                          <div className="ceo-leave-avatar">
                            {employeeName
                              .split(" ")
                              .filter(Boolean)
                              .slice(0, 2)
                              .map((part) => part[0])
                              .join("")
                              .toUpperCase()}
                          </div>

                          <div className="ceo-leave-employee-info">
                            <strong>{employeeName}</strong>
                            <span>
                              {getEmployeeEmail(request) ||
                                getEmployeeDepartment(request)}
                            </span>
                            <small>
                              {getEmployeeRole(request).replace(/_/g, " ")}
                            </small>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="ceo-leave-type">
                          {getLeaveType(request)}
                        </span>
                      </td>

                      <td>
                        <div className="ceo-leave-dates">
                          <CalendarDays size={15} />
                          <span>
                            {formatDate(startDate)}
                            {endDate &&
                            String(endDate) !== String(startDate)
                              ? ` – ${formatDate(endDate)}`
                              : ""}
                          </span>
                        </div>
                      </td>

                      <td>
                        <strong className="ceo-leave-duration">
                          {duration != null
                            ? `${duration} day${Number(duration) === 1 ? "" : "s"}`
                            : "—"}
                        </strong>
                      </td>

                      <td>
                        <span
                          className={`ceo-leave-status ${status}`}
                        >
                          <span />
                          {getStatusLabel(status)}
                        </span>
                      </td>

                      <td>
                        <div className="ceo-leave-actions">
                          <button
                            type="button"
                            className="ceo-leave-action view"
                            onClick={() =>
                              openReview(request, "view")
                            }
                            title="View request details"
                            aria-label={`View ${employeeName}'s leave request`}
                          >
                            <Eye size={16} />
                          </button>

                          {activeFilter === "pending" && (
                            <>
                              <button
                                type="button"
                                className="ceo-leave-action approve"
                                onClick={() =>
                                  openReview(request, "approved")
                                }
                                title="Approve request"
                                aria-label={`Approve ${employeeName}'s leave`}
                              >
                                <Check size={16} />
                              </button>

                              <button
                                type="button"
                                className="ceo-leave-action reject"
                                onClick={() =>
                                  openReview(request, "rejected")
                                }
                                title="Reject request"
                                aria-label={`Reject ${employeeName}'s leave`}
                              >
                                <X size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedRequest && (
        <div
          className="ceo-leave-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeReview();
            }
          }}
        >
          <section
            className="ceo-leave-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ceo-leave-modal-title"
          >
            <header className="ceo-leave-modal-header">
              <div>
                <span className="ceo-leave-eyebrow">
                  LEAVE REQUEST REVIEW
                </span>

                <h2 id="ceo-leave-modal-title">
                  {reviewAction === "approved"
                    ? "Approve Leave"
                    : reviewAction === "rejected"
                      ? "Reject Leave"
                      : "Leave Request Details"}
                </h2>
              </div>

              <button
                type="button"
                className="ceo-leave-modal-close"
                onClick={closeReview}
                disabled={submitting}
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
            </header>

            <div className="ceo-leave-modal-body">
              <div className="ceo-leave-modal-person">
                <div className="ceo-leave-avatar large">
                  {selectedName
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join("")
                    .toUpperCase()}
                </div>

                <div>
                  <h3>{selectedName}</h3>
                  <p>
                    {getEmployeeEmail(selectedRequest) ||
                      "Email not available"}
                  </p>
                  <span>
                    {getEmployeeRole(selectedRequest).replace(/_/g, " ")}
                  </span>
                </div>
              </div>

              <div className="ceo-leave-detail-grid">
                <div className="ceo-leave-detail">
                  <span>
                    <Building2 size={15} /> Department
                  </span>
                  <strong>
                    {getEmployeeDepartment(selectedRequest)}
                  </strong>
                </div>

                <div className="ceo-leave-detail">
                  <span>
                    <FileText size={15} /> Leave Type
                  </span>
                  <strong>{getLeaveType(selectedRequest)}</strong>
                </div>

                <div className="ceo-leave-detail">
                  <span>
                    <CalendarDays size={15} /> Start Date
                  </span>
                  <strong>
                    {formatDate(getStartDate(selectedRequest))}
                  </strong>
                </div>

                <div className="ceo-leave-detail">
                  <span>
                    <CalendarDays size={15} /> End Date
                  </span>
                  <strong>
                    {formatDate(getEndDate(selectedRequest))}
                  </strong>
                </div>

                <div className="ceo-leave-detail">
                  <span>
                    <Clock3 size={15} /> Duration
                  </span>
                  <strong>
                    {selectedRequest.totalDays ??
                      selectedRequest.days ??
                      selectedRequest.duration ??
                      "—"}
                    {selectedRequest.totalDays != null ||
                    selectedRequest.days != null ||
                    selectedRequest.duration != null
                      ? " day(s)"
                      : ""}
                  </strong>
                </div>

                <div className="ceo-leave-detail">
                  <span>
                    <UserRound size={15} /> Current Status
                  </span>
                  <strong>
                    {getStatusLabel(
                      getRequestStatus(selectedRequest)
                    )}
                  </strong>
                </div>
              </div>

              <div className="ceo-leave-reason">
                <span>Employee's Reason</span>
                <p>{getReason(selectedRequest)}</p>
              </div>

              {selectedRequest.medicalCertificate && (
                <div className="ceo-leave-certificate">
                  <FileText size={17} />
                  <div>
                    <strong>Medical certificate available</strong>
                    <p>
                      Check your backend's certificate endpoint to
                      view the attached document.
                    </p>
                  </div>
                </div>
              )}

              {selectedRequest.rejectionReason && (
                <div className="ceo-leave-reason previous">
                  <span>Rejection Reason</span>
                  <p>{selectedRequest.rejectionReason}</p>
                </div>
              )}

              {selectedRequest.comment && (
                <div className="ceo-leave-reason previous">
                  <span>Review Comment</span>
                  <p>{selectedRequest.comment}</p>
                </div>
              )}

              {reviewAction !== "view" &&
                getRequestStatus(selectedRequest) === "pending" && (
                  <form
                    id="ceo-leave-review-form"
                    onSubmit={submitReview}
                  >
                    {reviewAction === "rejected" && (
                      <label className="ceo-leave-form-field">
                        <span>
                          Rejection Reason <b>*</b>
                        </span>

                        <textarea
                          value={rejectionReason}
                          onChange={(event) => {
                            setRejectionReason(event.target.value);
                            setError("");
                          }}
                          placeholder="Explain why this leave request is being rejected..."
                          rows={3}
                          required
                          maxLength={2000}
                        />
                      </label>
                    )}

                    <label className="ceo-leave-form-field">
                      <span>
                        <MessageSquare size={15} />
                        Comment (optional)
                      </span>

                      <textarea
                        value={reviewComment}
                        onChange={(event) =>
                          setReviewComment(event.target.value)
                        }
                        placeholder="Add a comment for the employee or HR..."
                        rows={2}
                        maxLength={2000}
                      />
                    </label>
                  </form>
                )}

              {error && selectedRequest && (
                <div className="ceo-leave-error modal-error" role="alert">
                  <AlertCircle size={17} />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <footer className="ceo-leave-modal-footer">
              <button
                type="button"
                className="ceo-leave-cancel"
                onClick={closeReview}
                disabled={submitting}
              >
                {reviewAction === "view" ? "Close" : "Cancel"}
              </button>

              {reviewAction !== "view" &&
                getRequestStatus(selectedRequest) === "pending" && (
                  <button
                    type="submit"
                    form="ceo-leave-review-form"
                    className={
                      reviewAction === "approved"
                        ? "ceo-leave-submit approve"
                        : "ceo-leave-submit reject"
                    }
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <RefreshCw
                          size={16}
                          className="ceo-leave-spin"
                        />
                        Processing...
                      </>
                    ) : reviewAction === "approved" ? (
                      <>
                        <CheckCircle2 size={17} />
                        Confirm Approval
                      </>
                    ) : (
                      <>
                        <XCircle size={17} />
                        Confirm Rejection
                      </>
                    )}
                  </button>
                )}
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}