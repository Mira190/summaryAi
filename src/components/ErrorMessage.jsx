const ErrorMessage = ({ error }) => (
  <p className="font-inter font-bold text-black text-center">
    Well, that wasn&apos;t supposed to happen...
    <br />
    <span className="font-satoshi font-normal text-gray-700">
      {error?.message || "Something went wrong. Please try again."}
    </span>
  </p>
);

export default ErrorMessage;
