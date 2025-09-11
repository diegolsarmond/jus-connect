export interface Process {
  id: number;
  number: string;
  title: string;
  status: string;
}

export interface Client {
  id: number;
  name: string;
  email: string;
  phone: string;
  type: string;
  document: string;
  address: string;
  area: string;
  status: string;
  lastContact: string;
  processes: Process[];
}
