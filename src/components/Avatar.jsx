import "./Avatar.css";

const sizes = { sm: "avatar-sm", md: "avatar-md", lg: "avatar-lg" };

export default function Avatar({ name, size = "md", id = 0 }) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("");
  return <div className={`avatar ${sizes[size] || "avatar-md"} tint-${id % 6}`}>{initials}</div>;
}