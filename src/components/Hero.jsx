import { logo } from "../assets";

const REPO_URL = "https://github.com/Mira190/summaryAi";

const Hero = () => (
  <header className="w-full flex justify-center items-center flex-col">
    <nav className="flex justify-between items-center w-full mb-10 pt-3">
      <img src={logo} alt="SummaryAI logo" className="w-40 object-contain" />

      <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="black_btn">
        GitHub
      </a>
    </nav>

    <h1 className="head_text">
      Summarize Research Papers <br className="max-md:hidden" />
      <span className="orange_gradient">from a DOI</span>
    </h1>
    <h2 className="desc">
      Paste a DOI or an article link. SummaryAI looks up the paper on Crossref and generates a
      concise AI summary of the article — falling back to the publisher&apos;s abstract when the
      full text can&apos;t be read.
    </h2>
  </header>
);

export default Hero;
