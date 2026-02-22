import React from "react";
import AboutPageHero from "../components/about/AboutPageHero";
import OurStory from "../components/about/OurStory";
import PageMeta from "../components/common/PageMeta";
import CtaTwo from "../components/cta/CtaTwo";
import FeatureImgThree from "../components/features/FeatureImgThree";
import Team from "../components/team/Team";
import TestimonialTwo from "../components/testimonial/TestimonialTwo";
import FooterOne from "../layout/Footer/FooterOne";
import Navbar from "../layout/Header/Navbar";
import Layout from "../layout/Layout";

const About = () => {
  return (
    <Layout>
      <PageMeta title="About — ClearPanel Server Control Panel" />
      <Navbar classOption="navbar-light" />
      <AboutPageHero />
      <OurStory />
      <FeatureImgThree />
      <Team />
      <TestimonialTwo />
      <CtaTwo />
      <FooterOne footerLight />
    </Layout>
  );
};

export default About;
