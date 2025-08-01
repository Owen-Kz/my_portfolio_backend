const generateId = () => {
  return 'id_' + Math.random().toString(36).substr(2, 9);
}

module.exports = generateId;