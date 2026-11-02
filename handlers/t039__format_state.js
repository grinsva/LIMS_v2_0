
/**
 * Функция вывода значения "state" в виде строки
 * 
 *     device - Устройство (Object)
 *     prop = "state"
 *     val - исходное значение
 */
module.exports = function (device, prop, val) {
    if (val == 0) return "Закрыто";
    if (val == 1) return "Открыто";  
  }
