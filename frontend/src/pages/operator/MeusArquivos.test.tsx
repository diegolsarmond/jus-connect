import { render, screen } from "@testing-library/react";
import { describe, it, vi } from "vitest";
import MeusArquivos from "./MeusArquivos";

const appConfigMock = {
  ftp: undefined as
    | {
        host?: string;
        port?: number;
        user?: string;
        root?: string;
        secure: boolean;
      }
    | undefined,
};

vi.mock("@/config/app-config", () => ({
  appConfig: appConfigMock,
}));

describe("MeusArquivos", () => {
  it("exibe credenciais FTP quando configuradas", () => {
    appConfigMock.ftp = {
      host: "ftp.example.com",
      port: 2121,
      user: "user@example.com",
      root: "/workspace",
      secure: true,
    };

    render(<MeusArquivos />);

    expect(screen.getByDisplayValue("ftp.example.com:2121")).toBeInTheDocument();
    expect(screen.getByDisplayValue("user@example.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("/workspace")).toBeInTheDocument();
    expect(screen.getByText(/ftps ativo/i)).toBeInTheDocument();
  });

  it("exibe instruções quando a configuração FTP está ausente", () => {
    appConfigMock.ftp = undefined;

    render(<MeusArquivos />);

    expect(screen.getByText(/credenciais de ftp não estão configuradas/i)).toBeInTheDocument();
    expect(screen.getByText(/defina vite_ftp_host/i)).toBeInTheDocument();
  });
});
