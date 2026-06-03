import { getEmpPicture } from './config.js';

export const employees = [
  { emp_id: '021093', name: 'สมชาย ใจดี', department: 'บัญชี', position: 'เจ้าหน้าที่บัญชี', email: 'somchai@example.com' },
  { emp_id: '010241', name: 'วิชัย มั่นคง', department: 'บัญชี', position: 'หัวหน้าแผนก', email: 'wichai@example.com' },
  { emp_id: '010882', name: 'ประภา การเงิน', department: 'การเงิน', position: 'ผู้จัดการฝ่าย', email: 'prapa@example.com' },
  { emp_id: '011404', name: 'ธนา ระบบดี', department: 'IT', position: 'หัวหน้าแผนก IT', email: 'thana@example.com' },
  { emp_id: '014920', name: 'มาลี ประสานงาน', department: 'จัดซื้อ', position: 'ผู้จัดการฝ่าย', email: 'malee@example.com' },
  { emp_id: '019901', name: 'กิตติ อนุมัติ', department: 'บริหาร', position: 'ผู้บริหาร', email: 'kitti@example.com' },
];

export const currentUser = { ...employees[0], role: 'Requester', picture_url: getEmpPicture(employees[0].emp_id) };

export const requestTypes = [
  { id: 1, name: 'ติดตั้งโปรแกรม', description: 'ขอลงซอฟต์แวร์', is_active: true },
  { id: 2, name: 'ขอสิทธิ์เข้าระบบ', description: 'เปิดสิทธิ์ใช้งานระบบงาน', is_active: true },
  { id: 3, name: 'แจ้งซ่อมอุปกรณ์', description: 'คอมพิวเตอร์ เครื่องพิมพ์ เครือข่าย', is_active: true },
];

export const formDefinitions = {
  1: {
    id: 1,
    request_type_id: 1,
    name: 'แบบฟอร์มติดตั้งโปรแกรม',
    fields: [
      { id: 1, field_label: 'หัวข้อ', field_name: 'title', field_type: 'text', is_required: true, placeholder: 'เช่น ขอติดตั้ง Photoshop' },
      { id: 2, field_label: 'รายละเอียด', field_name: 'detail', field_type: 'textarea', is_required: true, placeholder: 'ระบุเหตุผลและเครื่องที่ต้องการติดตั้ง' },
      { id: 3, field_label: 'ชื่อโปรแกรม', field_name: 'software_name', field_type: 'text', is_required: true, placeholder: 'Adobe Photoshop 2024' },
      { id: 4, field_label: 'วันที่ต้องการใช้งาน', field_name: 'required_date', field_type: 'date', is_required: false },
      { id: 5, field_label: 'เบอร์ติดต่อ', field_name: 'phone', field_type: 'text', is_required: true, placeholder: '1234' },
    ],
  },
};

export const approvalTemplates = {
  1: [
    { id: 1, step_no: 1, slot_label: 'หัวหน้าแผนก', mode: 'fixed', fixed_emp_id: '010241', is_required: true },
    { id: 2, step_no: 2, slot_label: 'ผู้จัดการฝ่าย', mode: 'selectable', fixed_emp_id: null, is_required: true },
    { id: 3, step_no: 3, slot_label: 'หัวหน้าแผนก IT', mode: 'fixed', fixed_emp_id: '011404', is_required: true },
    { id: 4, step_no: 4, slot_label: 'ผู้อนุมัติงบประมาณ', mode: 'selectable', fixed_emp_id: null, is_required: true },
    { id: 5, step_no: 5, slot_label: 'ผู้บริหาร', mode: 'selectable', fixed_emp_id: null, is_required: false },
  ],
};

export const requests = [];

export function employeeById(empId) {
  return employees.find((employee) => employee.emp_id === empId);
}
