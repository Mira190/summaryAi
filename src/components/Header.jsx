const Header = ({ onOpenSettings }) => {
  return (
    <header className="w-full flex justify-center items-center flex-col">
      <nav className="flex justify-between items-center w-full mb-10 pt-3">
        <span className="font-satoshi font-black text-2xl text-white">
          summary<span className="orange_gradient">AI</span>
        </span>

        <div className="flex items-center gap-3">
          <button type="button" onClick={onOpenSettings} className="black_btn">
            Settings
          </button>
          <button
            type="button"
            onClick={() => window.open("https://github.com/mira190", "_blank")}
            className="black_btn"
          >
            GitHub
          </button>
        </div>
      </nav>

      <h1 className="head_text">
        Summaries you can <br className="max-md:hidden" />
        <span className="orange_gradient">check against the source</span>
      </h1>
      <h2 className="desc">
        Paste a DOI or a URL. Every claim links back to a verbatim quote from the
        text that was actually retrieved &mdash; and if only an abstract was
        available, we say so instead of guessing.
      </h2>
    </header>
  );
};

export default Header;
