export interface GreetingProps {
  name: string;
}

export function Greeting({ name }: GreetingProps) {
  return <div className="greeting">Hello, {name}!</div>;
}

export const SmallGreeting = ({ name }: GreetingProps) => <span>Hi, {name}</span>;
