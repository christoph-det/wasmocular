import { ButtonProps } from "./Button.types";
import { ButtonView } from "./ButtonView";

export const Button = function ButtonRender(props: ButtonProps) {
  return <ButtonView text={props.text} />;
};
