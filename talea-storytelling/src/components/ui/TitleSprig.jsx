export function TitleSprig({ className = "" }) {
  const classes = ["title-sprig", className].filter(Boolean).join(" ");

  return (
    <svg
      className={classes}
      viewBox="0 0 132 28"
      aria-hidden="true"
      focusable="false"
    >
      <path
        className="title-sprig-stem"
        d="M5 15.2c13.5-3.8 26.3-3.5 41.2-1.4H129"
      />
      <path
        className="title-sprig-leaf title-sprig-leaf--one"
        d="M17.8 13.2C13.4 7.3 7.1 6.5 2.2 9.1c3.3 5.4 9 7.1 15.6 4.1Z"
      />
      <path
        className="title-sprig-leaf title-sprig-leaf--two"
        d="M20.7 13.5C21.4 7 26 3.2 32.4 3.3c.2 6.2-4 10.3-11.7 10.2Z"
      />
      <path
        className="title-sprig-leaf title-sprig-leaf--three"
        d="M27.2 14.1c2.8 6.1 8.3 8.8 14.5 6.8-1.5-6-7.2-8.6-14.5-6.8Z"
      />
      <path
        className="title-sprig-leaf title-sprig-leaf--four"
        d="M39.4 13.2c1.6-6.1 6.3-9 12.4-7.8-.8 5.9-5.2 8.8-12.4 7.8Z"
      />
      <path
        className="title-sprig-leaf title-sprig-leaf--five"
        d="M45.6 13.9c2.6 4.6 7 6.2 11.9 4.2-2-4.5-6.5-6-11.9-4.2Z"
      />
    </svg>
  );
}
