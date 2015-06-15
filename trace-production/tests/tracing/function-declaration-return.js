function f1 (j) {

    function f2 (c) {
        var sum = c;
        var x;
        try {
            sum *= j;
            if (sum > 4) {
                sum = -sum;
            }
            i = 0;
            while(i < sum) {
                console.log(i);
                i++;
            }
            do {
                console.log(i);
                i--;
            } while (i > 0);

        } finally {
            return sum;
        }
    }

    return function f6(i) {
        return j + f2(i);
    }
}

f1(3)(5);