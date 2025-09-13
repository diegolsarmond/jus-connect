import React, { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Calendar, 
  Clock, 
  User, 
  MapPin, 
  Filter,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  Appointment,
  AppointmentFilter,
  AppointmentType,
  AppointmentStatus,
  appointmentTypes
} from '@/types/agenda';
import { statusLabel } from '@/components/agenda/status';

interface AppointmentListProps {
  appointments: Appointment[];
  onEdit?: (appointment: Appointment) => void;
  onDelete?: (appointmentId: string) => void;
  onView?: (appointment: Appointment) => void;
}

export function AppointmentList({ appointments, onEdit, onDelete, onView }: AppointmentListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<AppointmentType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | 'all'>('all');

  const filteredAppointments = appointments.filter((appointment) => {
    const matchesSearch = appointment.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         appointment.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         appointment.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = typeFilter === 'all' || appointment.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || appointment.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  const getStatusBadgeVariant = (status: AppointmentStatus) => {
      switch (status) {
        case 'agendado': return 'outline';
        case 'em_curso': return 'secondary';
        case 'concluido': return 'default';
        case 'cancelado': return 'destructive';
        default: return 'outline';
      }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Lista de Agendamentos
        </CardTitle>
        
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar agendamentos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as AppointmentType | 'all')}>
            <SelectTrigger className="w-full sm:w-40">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {Object.entries(appointmentTypes).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as AppointmentStatus | 'all')}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
                {Object.entries(statusLabel).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        {filteredAppointments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Nenhum agendamento encontrado</p>
            <p className="text-sm">Tente ajustar os filtros ou criar um novo agendamento</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pr-2">Título</TableHead>
                  <TableHead className="pl-2">Tipo</TableHead>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAppointments.map((appointment) => (
                  <TableRow key={appointment.id} className="group">
                    <TableCell className="pr-2">
                      <div className="space-y-1">
                        <p className="font-medium">{appointment.title}</p>
                        {appointment.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {appointment.description}
                          </p>
                        )}
                        {appointment.location && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {appointment.location}
                          </div>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="pl-2">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-3 h-3 rounded-full",
                          appointmentTypes[appointment.type].color
                        )} />
                        <span className="text-sm font-medium">
                          {appointmentTypes[appointment.type].label}
                        </span>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3" />
                          {format(appointment.date, "dd/MM/yyyy", { locale: ptBR })}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {appointment.startTime}
                          {appointment.endTime && ` - ${appointment.endTime}`}
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      {appointment.clientName ? (
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span className="text-sm">{appointment.clientName}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    
                    <TableCell>
                        <Badge variant={getStatusBadgeVariant(appointment.status)}>
                          {statusLabel[appointment.status]}
                        </Badge>
                    </TableCell>
                    
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {onView && (
                            <DropdownMenuItem onClick={() => onView(appointment)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Visualizar
                            </DropdownMenuItem>
                          )}
                          {onEdit && (
                            <DropdownMenuItem onClick={() => onEdit(appointment)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                          )}
                          {onDelete && (
                            <DropdownMenuItem 
                              onClick={() => onDelete(appointment.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}