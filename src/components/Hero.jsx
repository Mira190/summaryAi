import React from "react";

import { logo } from "../assets";

const Hero = () => {
  return (
    <header className="w-full flex justify-center items-center flex-col">
      <nav className="flex justify-between items-center w-full mb-10 pt-3">
        <img src={logo} alt="sumz_logo" className="w-40 object-contain" />

        <button
          type="button"
          onClick={() => window.open("https://github.com/mira190", "_blank")}
          className="black_btn"
        >
          GitHub
        </button>
      </nav>

      <h1 className="head_text">
        Summarize Your Research with <br className="max-md:hidden" />
        <span className="orange_gradient ">AI-Powered GPT4</span>
      </h1>
      <h2 className="desc">
        Revolutionize Your Research Process with Our AI-Enabled Literature
        Review Platform. Automatically Generate Accurate and Concise Summaries
        of Academic Papers in Seconds.
      </h2>
    </header>
  );
};

export default Hero;
