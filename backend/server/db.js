import mysql from 'mysql2/promise';
import { dbConfig, empDBEnabled, itServiceDBEnabled, itServiceEmpDBEnabled } from './config.js';

export const appDB = mysql.createPool({
  host: dbConfig.app.host,
  port: dbConfig.app.port,
  user: dbConfig.app.user,
  password: dbConfig.app.password,
  database: dbConfig.app.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
  charset: 'utf8mb4_unicode_ci',
});

export const empDB = empDBEnabled
  ? mysql.createPool({
      host: dbConfig.emp.host,
      port: dbConfig.emp.port,
      user: dbConfig.emp.user,
      password: dbConfig.emp.password,
      database: dbConfig.emp.database,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      dateStrings: true,
      charset: 'utf8mb4_unicode_ci',
    })
  : null;

export const itServiceDB = itServiceDBEnabled
  ? mysql.createPool({
      host: dbConfig.itService.host,
      port: dbConfig.itService.port,
      user: dbConfig.itService.user,
      password: dbConfig.itService.password,
      database: dbConfig.itService.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      dateStrings: true,
      charset: 'utf8mb4_unicode_ci',
    })
  : null;

export const itServiceEmpDB = itServiceEmpDBEnabled
  ? mysql.createPool({
      host: dbConfig.itServiceEmp.host,
      port: dbConfig.itServiceEmp.port,
      user: dbConfig.itServiceEmp.user,
      password: dbConfig.itServiceEmp.password,
      database: dbConfig.itServiceEmp.database,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      dateStrings: true,
      charset: 'utf8mb4_unicode_ci',
    })
  : null;

export async function pingAppDB() {
  const conn = await appDB.getConnection();
  try {
    await conn.ping();
    return true;
  } finally {
    conn.release();
  }
}

export async function pingEmpDB() {
  if (!empDB) return false;
  const conn = await empDB.getConnection();
  try {
    await conn.ping();
    return true;
  } finally {
    conn.release();
  }
}

export async function pingItServiceDB() {
  if (!itServiceDB) return false;
  const conn = await itServiceDB.getConnection();
  try {
    await conn.ping();
    return true;
  } finally {
    conn.release();
  }
}

export async function pingItServiceEmpDB() {
  if (!itServiceEmpDB) return false;
  const conn = await itServiceEmpDB.getConnection();
  try {
    await conn.ping();
    return true;
  } finally {
    conn.release();
  }
}
