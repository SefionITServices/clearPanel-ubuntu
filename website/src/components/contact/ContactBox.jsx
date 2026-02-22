import React from "react";

const ContactBox = () => {
  return (
    <>
      <section className="contact-promo ptb-120">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-4 col-md-6 mt-4 mt-lg-0">
              <div className="contact-us-promo p-5 bg-white rounded-custom custom-shadow text-center d-flex flex-column h-100">
                <span className="fab fa-discord fa-3x text-primary"></span>
                <div className="contact-promo-info mb-4">
                  <h5>Community Chat</h5>
                  <p>
                    Join our Discord server for real-time help, feature
                    discussions, and community support.
                  </p>
                </div>
                <a
                  href="https://discord.gg/clearpanel"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-link mt-auto"
                >
                  Join Discord
                </a>
              </div>
            </div>
            <div className="col-lg-4 col-md-6 mt-4 mt-lg-0">
              <div className="contact-us-promo p-5 bg-white rounded-custom custom-shadow text-center d-flex flex-column h-100">
                <span className="fas fa-envelope fa-3x text-primary"></span>
                <div className="contact-promo-info mb-4">
                  <h5>Email Us</h5>
                  <p>
                    Drop us an email at{" "}
                    <strong>support@sefion.com</strong> and
                    you'll receive a reply within 24 hours.
                  </p>
                </div>
                <a
                  href="mailto:support@sefion.com"
                  className="btn btn-primary mt-auto"
                >
                  Email Us
                </a>
              </div>
            </div>
            <div className="col-lg-4 col-md-6 mt-4 mt-lg-0">
              <div className="contact-us-promo p-5 bg-white rounded-custom custom-shadow text-center d-flex flex-column h-100">
                <span className="fab fa-github fa-3x text-primary"></span>
                <div className="contact-promo-info mb-4">
                  <h5>GitHub Issues</h5>
                  <p>
                    Found a bug or have a feature request? Open an issue on
                    our GitHub repository.
                  </p>
                </div>
                <a
                  href="https://github.com/SefionITServices/clearPanel-ubuntu/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-link mt-auto"
                >
                  Open Issue
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default ContactBox;
