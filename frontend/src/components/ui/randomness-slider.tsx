import React from "react";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RandomnessSliderProps {
  value: number[];
  setValue: (value: number[]) => void;
}

const RandomnessSlider = ({ value, setValue }: RandomnessSliderProps) => {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-medium">
          チーム分けのランダム性
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Slider
            defaultValue={[50]}
            max={100}
            min={0}
            step={1}
            value={value}
            onValueChange={setValue}
            className="w-full"
          />
          <div className="flex justify-between text-sm text-gray-500">
            <span>完全な最適化</span>
            <span className="font-medium">{value[0]}%</span>
            <span>ランダム性最大</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RandomnessSlider;
