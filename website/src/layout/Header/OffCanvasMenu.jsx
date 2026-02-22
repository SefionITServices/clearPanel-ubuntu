import React from "react";
import { Link } from "react-router-dom";

const OffCanvasMenu = () => {
  return (
    <div className="offcanvas-body">
      <ul className="nav col-12 col-md-auto justify-content-center main-menu">
        <li data-bs-dismiss="offcanvas" aria-label="Close">
          <Link to="/" className="nav-link">
            Home
          </Link>
        </li>
        <li data-bs-dismiss="offcanvas" aria-label="Close">
          <Link to="/about" className="nav-link">
            About
          </Link>
        </li>
        <li data-bs-dismiss="offcanvas" aria-label="Close">
          <Link to="/pricing" className="nav-link">
            Pricing
          </Link>
        </li>
        <li data-bs-dismiss="offcanvas" aria-label="Close">
          <Link to="/contact" className="nav-link">
            Contact
          </Link>
        </li>
      </ul>

      <div className="action-btns mt-4 ps-3">
        <a
          href="https://github.com/SefionITServices/clearPanel-ubuntu"
          className="btn btn-outline-primary text-decoration-none me-2"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
        <Link
          to="/pricing"
          className="btn btn-primary"
          data-bs-dismiss="offcanvas"
          aria-label="Close"
        >
          Get Started
        </Link>
      </div>
    </div>
  );
};

export default OffCanvasMenu;
