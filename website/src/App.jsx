import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ScrollToTop from "./components/common/ScrollToTop";
import HomeSoftApplication from "./themes/index5/HomeSoftApplication";
import About from "./pages/About";
import Pricing from "./pages/Pricing";
import Contact from "./pages/Contact";
import NotFoundScreen from "./components/others/NotFoundScreen";

// Swiper CSS
import "swiper/css";
import "swiper/css/navigation";

// Bootstrap JS
import "bootstrap/dist/js/bootstrap.bundle";

function App() {
  return (
    <Router>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomeSoftApplication />} />
        <Route path="/about" element={<About />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="*" element={<NotFoundScreen />} />
      </Routes>
    </Router>
  );
}

export default App;
