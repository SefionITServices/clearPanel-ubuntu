import React from "react";

const Team = () => {
  return (
    <>
      <section id="our-team" className="team-section pt-60 pb-120">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-6 col-md-12">
              <div className="section-heading text-center">
                <h5 className="h6 text-primary">Open Source</h5>
                <h2>Built by the Community, for the Community</h2>
                <p>
                  ClearPanel is maintained by Sefion IT Services and a growing
                  community of contributors. Everyone is welcome to contribute
                  — from code to documentation to bug reports.
                </p>
              </div>
            </div>
          </div>
          <div className="row justify-content-center">
            <div className="col-lg-3 col-md-6">
              <div className="team-single-wrap mb-5">
                <div className="p-4 bg-white rounded-custom custom-shadow text-center">
                  <div
                    className="rounded-circle bg-primary d-inline-flex align-items-center justify-content-center mb-3"
                    style={{ width: "80px", height: "80px" }}
                  >
                    <i className="fas fa-code text-white fa-2x"></i>
                  </div>
                  <div className="team-info mt-2">
                    <h5 className="h6 mb-1">Contribute Code</h5>
                    <p className="text-muted small mb-0">
                      Submit pull requests to add features, fix bugs, or
                      improve performance.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-lg-3 col-md-6">
              <div className="team-single-wrap mb-5">
                <div className="p-4 bg-white rounded-custom custom-shadow text-center">
                  <div
                    className="rounded-circle bg-success d-inline-flex align-items-center justify-content-center mb-3"
                    style={{ width: "80px", height: "80px" }}
                  >
                    <i className="fas fa-book text-white fa-2x"></i>
                  </div>
                  <div className="team-info mt-2">
                    <h5 className="h6 mb-1">Write Docs</h5>
                    <p className="text-muted small mb-0">
                      Help others by improving guides, tutorials, and API
                      documentation.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-lg-3 col-md-6">
              <div className="team-single-wrap mb-5">
                <div className="p-4 bg-white rounded-custom custom-shadow text-center">
                  <div
                    className="rounded-circle bg-warning d-inline-flex align-items-center justify-content-center mb-3"
                    style={{ width: "80px", height: "80px" }}
                  >
                    <i className="fas fa-bug text-white fa-2x"></i>
                  </div>
                  <div className="team-info mt-2">
                    <h5 className="h6 mb-1">Report Bugs</h5>
                    <p className="text-muted small mb-0">
                      Found an issue? Open a GitHub Issue and help us make
                      ClearPanel better.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-lg-3 col-md-6">
              <div className="team-single-wrap mb-5">
                <div className="p-4 bg-white rounded-custom custom-shadow text-center">
                  <div
                    className="rounded-circle bg-danger d-inline-flex align-items-center justify-content-center mb-3"
                    style={{ width: "80px", height: "80px" }}
                  >
                    <i className="fas fa-comments text-white fa-2x"></i>
                  </div>
                  <div className="team-info mt-2">
                    <h5 className="h6 mb-1">Join Discussions</h5>
                    <p className="text-muted small mb-0">
                      Share ideas, ask questions, and connect with other
                      server admins.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="row justify-content-center mt-3">
            <div className="col-auto">
              <a
                href="https://github.com/SefionITServices/clearPanel-ubuntu"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
              >
                <i className="fab fa-github me-2"></i>View on GitHub
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default Team;
