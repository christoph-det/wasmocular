import { cn } from "@/lib/utils";
import { ButtonProps } from "./Button.types";

const Button = (props: Readonly<ButtonProps>) => {
  const buttonElement = (
    <button
      className={cn(`bg-primary py-1.5 px-4 hover:bg-primary-700 text-white font-bold rounded cursor-pointer ${props.secondary ? "bg-secondary hover:bg-secondary-500" : ""})`, props.className ?? "")}
      onClick={props.onClick}
    >
      {props.text}
    </button>
  );

  if (props.center) {
    return <div className="flex justify-center">{buttonElement}</div>;
  }

  return buttonElement;
};

export default Button;
