import React from "react";
const Layout = ({ children, hasClass, classOpt }) => {
  return (
    <div
      className={`main-wrapper ${classOpt} ${
        hasClass ? "overflow-hidden" : null
      }`}
    >
      {children}
    </div>
  );
};

export default Layout;
