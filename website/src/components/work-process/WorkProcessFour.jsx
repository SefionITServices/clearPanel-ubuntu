import React from 'react';

const WorkProcessFour = () => {
  return (
    <>
      <section className='work-process ptb-120'>
        <div className='container'>
          <div className='row justify-content-center'>
            <div className='col-md-10 col-lg-6'>
              <div className='section-heading text-center'>
                <h4 className='h5 text-primary'>How It Works</h4>
                <h2>Get Started in 4 Simple Steps</h2>
                <p>
                  From a fresh Ubuntu server to a fully managed hosting panel
                  in under 5 minutes. No complex configuration required.
                </p>
              </div>
            </div>
          </div>
          <div className='row d-flex align-items-center'>
            <div className='col-md-6 col-lg-3'>
              <div className='process-card text-center px-4 py-lg-5 py-4 rounded-custom shadow-hover mb-2 mb-lg-0'>
                <div className='process-icon border border-light bg-custom-light rounded-custom p-3'>
                  <span className='h2 mb-0 text-primary fw-bold'>1</span>
                </div>
                <h3 className='h5'>Install</h3>
                <p className='mb-0'>
                  Run the one-line installer on your Ubuntu VPS.
                </p>
              </div>
            </div>
            <div className='dots-line first'></div>
            <div className='col-md-6 col-lg-3'>
              <div className='process-card text-center px-4 py-lg-5 py-3 rounded-custom shadow-hover mb-2 mb-lg-0'>
                <div className='process-icon border border-light bg-custom-light rounded-custom p-3'>
                  <span className='h2 mb-0 text-primary fw-bold'>2</span>
                </div>
                <h3 className='h5'>Configure</h3>
                <p className='mb-0'>
                  Follow the setup wizard to configure your server.
                </p>
              </div>
            </div>
            <div className='dots-line first'></div>
            <div className='col-md-6 col-lg-3'>
              <div className='process-card text-center px-4 py-lg-5 py-4 rounded-custom shadow-hover mb-2 mb-lg-0 mb-md-0'>
                <div className='process-icon border border-light bg-custom-light rounded-custom p-3'>
                  <span className='h2 mb-0 text-primary fw-bold'>3</span>
                </div>
                <h3 className='h5'>Deploy</h3>
                <p className='mb-0'>
                  Add domains, email, and databases in seconds.
                </p>
              </div>
            </div>
            <div className='dots-line first'></div>
            <div className='col-md-6 col-lg-3'>
              <div className='process-card text-center px-4 py-lg-5 py-4 rounded-custom shadow-hover mb-0 mb-lg-0 mb-md-0'>
                <div className='process-icon border border-light bg-custom-light rounded-custom p-3'>
                  <span className='h2 mb-0 text-primary fw-bold'>4</span>
                </div>
                <h3 className='h5'>Monitor</h3>
                <p className='mb-0'>
                  Track resources, logs, and health 24/7.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default WorkProcessFour;
