
/**
 * Функция вывода значения "state" в виде строки
 * 
 *     device - Устройство (Object)
 *     prop = "state"
 *     val - исходное значение
 */
module.exports = function (device, prop, val) {
    if (val == 2) return "Критическое максимальное значение"; 
    if (val == 1) return "Превышение максимального значения";     
    if (val == 0) return "Норма";
    if (val == -1) return "Превышение минимального значения"; 
    if (val == -2) return "Критическое минимальное значение";         
  }
