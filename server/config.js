export const config = {
  PORT: Number(process.env.PORT || 5101),
  APP_NAME: process.env.APP_NAME || 'itrequest',
  BASE_PATH: process.env.BASE_PATH || '/itrequest',
  API_PREFIX: process.env.API_PREFIX || '/itrequest/api',
  EMP_PICTURE_BASE_URL: process.env.EMP_PICTURE_BASE_URL || 'http://www.pssugar.com/empPicture',
  USE_MOCKS: process.env.USE_MOCKS !== 'false',
};

export const getEmpPicture = (empId) => `${config.EMP_PICTURE_BASE_URL}/${empId}.jpg`;
