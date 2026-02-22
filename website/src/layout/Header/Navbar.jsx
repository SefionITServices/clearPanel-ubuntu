import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import OffCanvasMenu from "./OffCanvasMenu";
import { HiMenu, HiOutlineX } from "react-icons/hi";

const Navbar = ({ navDark, classOption }) => {
  const [scroll, setScroll] = useState(0);
  const [headerTop, setHeaderTop] = useState(0);

  useEffect(() => {
    const stickyheader = document.querySelector(".main-header");
    setHeaderTop(stickyheader.offsetTop);
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const handleScroll = () => {
    setScroll(window.scrollY);
  };

  return (
    <>
      <header
        className={`main-header z-10 ${
          navDark ? "position-absolute " : ""
        } w-100 ${classOption || ""}`}
      >
        <nav
          className={`navbar navbar-expand-xl z-50 ${
            navDark ? "navbar-dark " : "navbar-light"
          } sticky-header ${scroll > headerTop ? "affix" : ""}`}
        >
          <div className="container d-flex align-items-center justify-content-lg-between position-relative">
            <Link to="/">
              {scroll > headerTop || !navDark ? (
                <img
                  width={160}
                  height={36}
                  src="/img/logo-color.png"
                  alt="ClearPanel"
                  className="img-fluid logo-color"
                />
              ) : (
                <img
                  width={160}
                  height={36}
                  src="/img/logo-white.png"
                  alt="ClearPanel"
                  className="img-fluid logo-white"
                />
              )}
            </Link>
            <button
              className="navbar-toggler position-absolute right-0 border-0"
              id="#offcanvasWithBackdrop"
              role="button"
            >
              <span
                data-bs-toggle="offcanvas"
                data-bs-target="#offcanvasWithBackdrop"
                aria-controls="offcanvasWithBackdrop"
              >
                <HiMenu />
              </span>
            </button>
            <div className="clearfix"></div>
            <div className="collapse navbar-collapse justify-content-center">
              <ul className="nav col-12 col-md-auto justify-content-center main-menu">
                <li>
                  <Link to="/" className="nav-link">
                    Home
                  </Link>
                </li>
                <li>
                  <Link to="/about" className="nav-link">
                    About
                  </Link>
                </li>
                <li>
                  <Link to="/pricing" className="nav-link">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className="nav-link">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>

            <div className="action-btns text-end me-5 me-lg-0 d-none d-md-block d-lg-block">
              <a
                href="https://github.com/SefionITServices/clearPanel-ubuntu"
                className="btn btn-link text-decoration-none me-2"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
              <Link to="/pricing" className="btn btn-primary">
                Get Started
              </Link>
            </div>

            <div
              className="offcanvas offcanvas-end d-xl-none"
              tabIndex="-1"
              id="offcanvasWithBackdrop"
            >
              <div className="offcanvas-header d-flex align-items-center mt-4">
                <Link
                  to="/"
                  className="d-flex align-items-center mb-md-0 text-decoration-none"
                >
                  <img
                    width={160}
                    height={36}
                    src="/img/logo-color.png"
                    alt="ClearPanel"
                    className="img-fluid ps-2"
                  />
                </Link>
                <button
                  type="button"
                  className="close-btn text-danger"
                  data-bs-dismiss="offcanvas"
                  aria-label="Close"
                >
                  <HiOutlineX />
                </button>
              </div>
              <OffCanvasMenu />
            </div>
          </div>
        </nav>
      </header>
    </>
  );
};

export default Navbar;
