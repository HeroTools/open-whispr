#!/usr/bin/env python3
"""
Analyze performance logs to compare GPT-4.1-mini vs GPT-5-mini
"""

import json
import sys
from collections import defaultdict


def analyze_model_performance(log_file="performance_logs.jsonl"):
    """Analyze and compare performance between different reasoning models"""
    
    model_stats = defaultdict(lambda: {
        'times': [],
        'text_lengths': [],
        'count': 0
    })
    
    try:
        with open(log_file, 'r', encoding='utf-8') as f:
            for line in f:
                try:
                    session = json.loads(line.strip())
                    
                    # Look for reasoning steps
                    for step_name, step_data in session.get('steps', {}).items():
                        if 'reasoning' in step_name.lower() or 'post_processing' in step_name.lower():
                            model = step_data.get('model', 'unknown')
                            duration = step_data.get('duration_ms', 0)
                            text_length = step_data.get('text_length', 0)
                            
                            if model != 'unknown':
                                model_stats[model]['times'].append(duration)
                                if text_length > 0:
                                    model_stats[model]['text_lengths'].append(text_length)
                                model_stats[model]['count'] += 1
                
                except json.JSONDecodeError:
                    continue
        
        if not model_stats:
            print("❌ No model performance data found in logs")
            return
        
        # Print comparison
        print("\n" + "="*70)
        print("📊 Model Performance Comparison")
        print("="*70)
        
        models = sorted(model_stats.keys())
        
        for model in models:
            stats = model_stats[model]
            times = stats['times']
            text_lengths = stats['text_lengths']
            
            if not times:
                continue
            
            avg_time = sum(times) / len(times)
            min_time = min(times)
            max_time = max(times)
            avg_text_len = sum(text_lengths) / len(text_lengths) if text_lengths else 0
            
            print(f"\n🤖 {model}")
            print(f"   {'─'*60}")
            print(f"   Samples: {stats['count']}")
            print(f"   Average Time: {avg_time:.0f}ms")
            print(f"   Min Time: {min_time:.0f}ms")
            print(f"   Max Time: {max_time:.0f}ms")
            print(f"   Time Range: {max_time - min_time:.0f}ms")
            if avg_text_len > 0:
                print(f"   Avg Text Length: {avg_text_len:.0f} chars")
                print(f"   Time per Char: {avg_time/avg_text_len:.1f}ms/char")
        
        # Compare if we have multiple models
        if len(models) >= 2:
            print(f"\n{'='*70}")
            print("⚖️  Comparison")
            print(f"{'='*70}")
            
            # Compare first two models
            model1, model2 = models[0], models[1]
            avg1 = sum(model_stats[model1]['times']) / len(model_stats[model1]['times'])
            avg2 = sum(model_stats[model2]['times']) / len(model_stats[model2]['times'])
            
            if avg1 < avg2:
                faster, slower = model1, model2
                faster_avg, slower_avg = avg1, avg2
            else:
                faster, slower = model2, model1
                faster_avg, slower_avg = avg2, avg1
            
            speedup = slower_avg / faster_avg
            time_diff = slower_avg - faster_avg
            
            print(f"\n✅ {faster} is FASTER")
            print(f"   {faster}: {faster_avg:.0f}ms average")
            print(f"   {slower}: {slower_avg:.0f}ms average")
            print(f"   Difference: {time_diff:.0f}ms ({speedup:.1f}x faster)")
            print(f"   {slower} is {((speedup-1)*100):.0f}% slower than {faster}")
        
        print(f"\n{'='*70}\n")
        
    except FileNotFoundError:
        print(f"❌ Log file not found: {log_file}")
        print("   Run some transcriptions first to generate logs")


if __name__ == "__main__":
    log_file = sys.argv[1] if len(sys.argv) > 1 else "performance_logs.jsonl"
    analyze_model_performance(log_file)
