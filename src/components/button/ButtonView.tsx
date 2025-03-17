export function ButtonView(props: any) {
  return (
    <button className="bg-primary py-1.5 px-4 hover:bg-primary-700 text-white font-bold rounded cursor-pointer">
      {props.text}
    </button>
  );
}
