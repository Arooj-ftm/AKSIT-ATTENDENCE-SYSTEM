
import { CalendarCheck, RefreshCw } from "lucide-react";
import "./PageHeader.css";

const PageHeader = ({
    eyebrow = "WORKSPACE",
    title = "Dashboard",
    description = "",
    onRefresh,
    refreshing = false,
    actions = null,
    icon: EyebrowIcon = CalendarCheck,
    className = "",
}) => {
    const handleRefresh = () => {
        if (refreshing) return;

        if (typeof onRefresh === "function") {
            onRefresh();
            return;
        }

        // Fallback until the page's refresh function is connected.
        if (typeof window !== "undefined") {
            window.location.reload();
        }
    };

    return (
        <header className={`page-header ${className}`.trim()}>
            <div className="page-header__eyebrow">
                <EyebrowIcon
                    size={15}
                    strokeWidth={2}
                    aria-hidden="true"
                />

                <span>{eyebrow}</span>
            </div>

            <div className="page-header__main">
                <div className="page-header__content">
                    <h1 className="page-header__title">
                        {title}
                    </h1>

                    {description && (
                        <p className="page-header__description">
                            {description}
                        </p>
                    )}
                </div>

                <div className="page-header__actions">
                    {actions}

                    <button
                        type="button"
                        className="page-header__refresh"
                        onClick={handleRefresh}
                        disabled={refreshing}
                        aria-label="Refresh all data"
                    >
                        <RefreshCw
                            size={16}
                            className={
                                refreshing
                                    ? "page-header__refresh-icon is-spinning"
                                    : "page-header__refresh-icon"
                            }
                        />

                        <span>
                            {refreshing ? "Refreshing..." : "Refresh All"}
                        </span>
                    </button>
                </div>
            </div>
        </header>
    );
};

export default PageHeader;
