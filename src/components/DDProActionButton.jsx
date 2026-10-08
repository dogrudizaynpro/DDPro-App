import DDProIcon from "./DDProIcon.jsx";

function DDProActionButton({
  icon,
  label,
  onClick,
  type = "button",
  disabled = false,
  ariaExpanded,
  className = "",
}) {
  return (
    <button
      className={`ddpro-icon-action ${className}`.trim()}
      type={type}
      aria-label={label}
      aria-expanded={ariaExpanded}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      <DDProIcon name={icon} />
    </button>
  );
}

export default DDProActionButton;
