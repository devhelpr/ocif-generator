declare module "react-webcola" {
  import { ReactNode } from "react";

  interface ColaNode {
    id: string;
    x?: number;
    y?: number;
    [key: string]: any;
  }

  interface ColaLink {
    source: ColaNode;
    target: ColaNode;
    [key: string]: any;
  }

  interface ColaLayoutProps {
    nodes: ColaNode[];
    links: ColaLink[];
    width: number;
    height: number;
    nodeSpacing?: number;
    linkDistance?: number;
    iterations?: number;
    onLayoutEnd?: () => void;
    children: (nodes: ColaNode[], links: ColaLink[]) => ReactNode;
  }

  export const ColaLayout: React.FC<ColaLayoutProps>;
}
